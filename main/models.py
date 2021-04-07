from django.db import models
from datetime import datetime, timezone, timedelta
import logging, time, os

from .services import ExifToolService, MetadataParserService
from .model import metadata_parser
from .model.file_types import FileType


class Author(models.Model):
    name = models.CharField(max_length=255)

    def is_unknown(self):
        return self.name == "Unknown"

    def __str__(self):
        return self.name


class Directory(models.Model):
    parent = models.ForeignKey("self", null=True, on_delete=models.CASCADE, related_name="subdirs")
    path = models.CharField(max_length=255)

    def scan(self, reload_metadata=False):
        start = time.time()

        # if reload: remove all old information
        if reload_metadata:
            self.images.all().delete()
            self.subdirs.all().delete()

        # then scan for all contents and add them to the DB
        abs_path = self.get_absolute_path()
        contents = os.listdir(abs_path)
        new_images = []
        new_dirs = []
        new_attachments = []

        # create sub-items (both images and subdirs)
        existing_images = self.images.values_list('name', flat=True)
        existing_dirs = self.subdirs.values_list('path', flat=True)
        for item_name in contents:
            item_path = os.path.join(abs_path, item_name)
            if self._is_image(item_path) and not item_name in existing_images:
                img = Image(parent=self, name=item_name)
                new_images.append(img)
            elif os.path.isdir(item_path) and not item_name in existing_dirs:
                new_dirs.append(Directory(parent=self, path=item_name))

        # if we have new images, scan their metadata
        if new_images:
            json = ExifToolService.instance().read_metadata(self.get_absolute_path(), *new_images)
            for i, j in zip(new_images, json):
                i.load_metadata(j)

        Image.objects.bulk_create(new_images, batch_size=100)
        Directory.objects.bulk_create(new_dirs, batch_size=100)

        # create attachments
        existing_images = self.images.all()
        for item_name in contents:
            item_path = os.path.join(abs_path, item_name)
            if self._is_attachment(item_path):
                related_image = self._find_related_image(existing_images, item_name)
                if related_image is not None and not related_image.attachments.filter(name=item_name).exists():
                    att = Attachment(parent=related_image, name=item_name, attachment_type=FileType.from_path(item_path).name)
                    new_attachments.append(att)
        Attachment.objects.bulk_create(new_attachments, batch_size=100)

        for d in self.subdirs.all():
            d.scan()

        print("Scanned %s [%d], %ss" % (self.get_absolute_path(), self.id, time.time()-start))

    def remove_from_db(self):
        Directory.objects.filter(id=self.id).delete()

    def get_absolute_path(self):
        if self.parent is None:
            return self.path
        else:
            return os.path.join(self.parent.get_absolute_path(), self.path)

    def organize_into_directories(self):
        ExifToolService.instance().organize_into_directories(self.get_absolute_path())

    def geotag(self):
        ExifToolService.instance().geotag(self.get_absolute_path())

    def set_author(self, author):
        self.images.update(author=author)

    def write_images_metadata(self):
        ExifToolService.instance().write_metadata(self.get_absolute_path(), *self.images.all())
    
    def _is_image(self, path):
        return os.path.isfile(path) and FileType.from_path(path) == FileType.MAIN_MEDIA

    def _is_attachment(self, path):
        return os.path.isfile(path) and FileType.from_path(path) != FileType.MAIN_MEDIA

    def _find_related_image(self, images, path):
        for i in images:
            if os.path.splitext(path)[0] == os.path.splitext(i.name)[0]:
                return i
        return None

    def __str__(self):
        return self.get_absolute_path()


class Image(models.Model):
    logger = logging.getLogger(__name__)

    parent = models.ForeignKey(Directory, on_delete=models.CASCADE, related_name="images")
    name = models.CharField(max_length=255)
    author = models.ForeignKey(Author, on_delete=models.SET_NULL, null=True)
    date_time_utc = models.DateTimeField(null=True)
    # store the time offset, since DateTimeFields are stored in UTC...
    tz_offset_seconds = models.IntegerField(default=0)

    def read_metadata(self):
        # read metadata from EXIF here. No need to save(), the caller can do that
        json = ExifToolService.instance().read_metadata(self.parent.get_absolute_path(), self)
        self.load_metadata(json[0])

    def load_metadata(self, json):
        if not json["SourceFile"] == self.name:
            raise ValueError("metadata does not match this image: %s <> %s" % (json["SourceFile"], self.name))

        metadata = MetadataParserService.instance().parse_metadata(json)

        if metadata.artist:  # check for empty string
            new_auth = Author.objects.filter(name=metadata.artist).first()
            if new_auth is None:
                new_auth = Author.objects.filter(name="Unknown").first()
            self.author = new_auth

        if metadata.date_time_original:
            self.date_time_utc = metadata.date_time_original.astimezone(timezone.utc)
            self.tz_offset_seconds = metadata.date_time_original.tzinfo.utcoffset(
                metadata.date_time_original
            ).total_seconds()

    @property
    def date_time(self):
        if self.date_time_utc:
            return self.date_time_utc.astimezone(timezone(timedelta(seconds=self.tz_offset_seconds)))
        else:
            return None

    def write_metadata(self):
        ExifToolService.instance().write_metadata(self.parent.get_absolute_path(), self)

    def __str__(self):
        return os.path.join(self.parent.get_absolute_path(), self.name)


class Attachment(models.Model):
    parent = models.ForeignKey(Image, on_delete=models.CASCADE, related_name="attachments")
    name = models.CharField(max_length=255)
    attachment_type = models.CharField(max_length=50)
