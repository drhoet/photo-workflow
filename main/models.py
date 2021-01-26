from django.db import models
from os import listdir
from os.path import isfile, isdir, join
from datetime import datetime, timezone, timedelta
import logging

from .services import ExifToolService, MetadataParserService
from .model import metadata_parser


class Author(models.Model):
    name = models.CharField(max_length=255)

    def is_unknown(self):
        return self.name == "Unknown"

    def __str__(self):
        return self.name


class Directory(models.Model):
    parent = models.ForeignKey("self", null=True, on_delete=models.CASCADE, related_name="subdirs")
    path = models.CharField(max_length=255)

    def scan(self):
        # first delete the old contents. TODO: This is probably not a very nice solution ;-)
        print("Scanning %s [%d]" % (self.get_absolute_path(), self.id))
        self.subdirs.all().delete()
        self.images.all().delete()

        # then scan for all contents and add them to the DB
        abs_path = self.get_absolute_path()
        contents = listdir(abs_path)
        new_images = []
        new_dirs = []

        # create sub-items (both images and subdirs)
        for item_name in contents:
            item_path = join(abs_path, item_name)
            if isfile(item_path):
                img = Image(parent=self, name=item_name)
                new_images.append(img)
            elif isdir(item_path):
                new_dirs.append(Directory(parent=self, path=item_name))

        # if we have images, scan their metadata
        files = [img.name for img in new_images]
        if files:
            json = ExifToolService.instance().read_metadata(self.get_absolute_path(), *files)
            for i, j in zip(new_images, json):
                i.load_metadata(j)

        Image.objects.bulk_create(new_images, batch_size=100)
        Directory.objects.bulk_create(new_dirs, batch_size=100)

        for d in self.subdirs.all():
            d.scan()

    def get_absolute_path(self):
        if self.parent is None:
            return self.path
        else:
            return join(self.parent.get_absolute_path(), self.path)

    def organize_into_directories(self):
        ExifToolService.instance().organize_into_directories(self.get_absolute_path())

    def geotag(self):
        ExifToolService.instance().geotag(self.get_absolute_path())

    def set_author(self, author):
        self.images.update(author=author)

    def write_images_metadata(self):
        ExifToolService.instance().write_metadata(self.get_absolute_path(), *self.images.all())

    def __str__(self):
        return self.get_absolute_path()


class Image(models.Model):
    parent = models.ForeignKey(Directory, on_delete=models.CASCADE, related_name="images")
    name = models.CharField(max_length=255)
    author = models.ForeignKey(Author, on_delete=models.SET_NULL, null=True)
    date_time_utc = models.DateTimeField(null=True)
    tz_offset_seconds = models.IntegerField(
        default=0
    )  # store the time offset, since DateTimeFields are stored in UTC...

    def read_metadata(self):
        # read metadata from EXIF here. No need to save(), the caller can do that
        json = ExifToolService.instance().read_metadata(self.parent.get_absolute_path(), self.name)
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
            self.tz_offset_seconds = metadata.date_time_original.tzinfo.utcoffset(metadata.date_time_original).total_seconds()

    @property
    def date_time(self):
        if self.date_time_utc:
            return self.date_time_utc.astimezone(timezone(timedelta(seconds=self.tz_offset_seconds)))
        else:
            return None

    def write_metadata(self):
        ExifToolService.instance().write_metadata(self.parent.get_absolute_path(), self)

    def __str__(self):
        return join(self.parent.get_absolute_path(), self.name)
