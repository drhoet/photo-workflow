from django.db import models
from django.db.models import F
from django.db.models.functions import Coalesce, Cast
from django.dispatch import receiver
from datetime import datetime, timezone, timedelta
from PIL import Image as PIL_Image, ImageOps as PIL_ImageOps
from io import BytesIO
from django.core.files import File
import logging, time, os

from .services import ExifToolService, MetadataParserService, GpsTrackParserService, GeotaggingService
from .model.file_types import FileType
from .utils.datetime import has_timezone

class UiException(Exception):
    pass


class MetadataIncompleteError(UiException):

    def __init__(self, name, errors):
        self.name = name
        self.errors = errors
        super().__init__(f"Incomplete metadata for image {name}: {','.join(errors)}")

    def as_dict(self):
        return {
            "type": "MetadataIncompleteError",
            "message": str(self),
            "image_name": self.name,
            "image_errors": self.errors
        }

class ImageSetActionError(UiException):

    def __init__(self, message, image_names):
        self.image_names = image_names
        self.message = message
        super().__init__(f"{message}: {','.join(image_names)}")

    def as_dict(self):
        return {
            "type": "ImageSetActionError",
            "message": str(self),
            "detail_message": self.message,
            "image_names": self.image_names
        }


class Author(models.Model):
    name = models.CharField(max_length=255)

    def is_unknown(self):
        return self.name == "Unknown"

    def __str__(self):
        return self.name


class Directory(models.Model):
    logger = logging.getLogger(__name__)

    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.CASCADE, related_name="subdirs")
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

        # if we have new images, scan their metadata and create a thumbnail
        if new_images:
            json = ExifToolService.instance().read_metadata(self.get_absolute_path(), *new_images)
            for i, j in zip(new_images, json):
                i.load_metadata(j)
                i.create_thumbnail()

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

    def write_images_metadata(self):
        for img in self.images.all():
            if img.errors:
                raise MetadataIncompleteError(img.name, img.errors)
        ExifToolService.instance().write_metadata(self.get_absolute_path(), *self.images.all())
    
    def parse_tracks(self):
        abs_path = self.get_absolute_path()
        contents = os.listdir(abs_path)

        result = []
        for item_name in contents:
            item_path = os.path.join(abs_path, item_name)
            track = GpsTrackParserService.instance().parse_track(item_path)
            if track is not None:
                result.append({
                    "id": f"{self.id}/{item_name}",
                    "display_name": item_name,
                    "data": track
                })
        return result
    
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
    tz_offset = models.DurationField(null=True)
    thumbnail = models.FileField(upload_to=f"thumbnails", null=True)
    gps_longitude = models.FloatField(null=True)
    gps_latitude = models.FloatField(null=True)
    gps_altitude = models.FloatField(null=True)

    def read_metadata(self):
        # read metadata from EXIF here. No need to save(), the caller can do that
        json = self.read_exif_json_from_file()
        self.load_metadata(json)

    def load_metadata(self, json):
        if not json["SourceFile"] == self.name:
            raise ValueError("metadata does not match this image: %s <> %s" % (json["SourceFile"], self.name))

        metadata = MetadataParserService.instance().parse_metadata(json)

        if metadata.artist:  # check for empty string
            new_auth = Author.objects.filter(name=metadata.artist).first()
            if new_auth is None:
                new_auth = Author.objects.filter(name="Unknown").first()
            self.author = new_auth

        if metadata.date_time_original is not None:
            self.date_time_utc = metadata.date_time_original.astimezone(timezone.utc)
            if metadata.date_time_original.tzinfo is not None:
                self.tz_offset = metadata.date_time_original.tzinfo.utcoffset(metadata.date_time_original)
        
        if metadata.longitude is not None and metadata.latitude is not None:
            self.gps_longitude = metadata.longitude
            self.gps_latitude = metadata.latitude
            if metadata.altitude is not None:
                self.gps_altitude = metadata.altitude

    def create_thumbnail(self):
        try:
            pil_image = PIL_Image.open(os.path.join(self.parent.get_absolute_path(), self.name))
            pil_image = PIL_ImageOps.exif_transpose(pil_image)
            
            width_percent = (300 / float(pil_image.size[0]))
            height_percent = (200 / float(pil_image.size[1]))

            percent = min(width_percent, height_percent)

            target_width = int((float(pil_image.size[0]) * float(percent)))
            target_height = int((float(pil_image.size[1]) * float(percent)))
            self.logger.info(f"Resizing image {self.name} to ({target_width}, {target_height})")
            pil_image = pil_image.resize((target_width, target_height), PIL_Image.ANTIALIAS)

            img_raw = BytesIO()
            pil_image.save(img_raw, "JPEG")
            self.thumbnail = File(img_raw, name=f"{self.parent.id}/{self.name}")
        except Exception as err:
            self.logger.warn(f"Could not create thumbnail for {self.name}: {err}")

    @property
    def date_time(self):
        if self.date_time_utc is not None:
            if self.tz_offset is None:
                return self.date_time_utc.replace(tzinfo=None)
            else:
                return self.date_time_utc.astimezone(timezone(self.tz_offset))
        else:
            return None

    @property
    def errors(self):
        res = []
        if self.date_time_utc is None:
            res.append('Missing DateTimeOriginal')
        elif self.tz_offset is None:
            res.append('Missing time zone information')
        if self.author is None:
            res.append('Missing author')
        return res

    def read_exif_json_from_file(self):
        return ExifToolService.instance().read_metadata(self.parent.get_absolute_path(), self)[0]

    def write_metadata(self):
        if self.errors:
            raise MetadataIncompleteError(self.name, self.errors)
        else:
            ExifToolService.instance().write_metadata(self.parent.get_absolute_path(), self)

    def __str__(self):
        return os.path.join(self.parent.get_absolute_path(), self.name)

@receiver(models.signals.post_delete, sender=Image)
def auto_delete_file_on_delete(sender, instance, **kwargs):
    """
    Deletes file from filesystem when corresponding Image object is deleted.
    """
    if instance.thumbnail:
        if os.path.isfile(instance.thumbnail.path):
            os.remove(instance.thumbnail.path)


class Attachment(models.Model):
    parent = models.ForeignKey(Image, on_delete=models.CASCADE, related_name="attachments")
    name = models.CharField(max_length=255)
    attachment_type = models.CharField(max_length=50)


class ImageSetService:
    __instance = None
    logger = logging.getLogger(__name__)

    @classmethod
    def instance(cls):
        if cls.__instance is not None:
            return cls.__instance
        else:
            cls.__instance = ImageSetService()
            return cls.__instance

    def overwrite_timezone(self, image_ids, tz_minutes):
        self.logger.info(f"Setting time zone to '{tz_minutes}' for images {image_ids}")
        images = Image.objects.filter(pk__in = image_ids, date_time_utc__isnull=False)
        images.update(tz_offset = timedelta(minutes=tz_minutes), date_time_utc = F('date_time_utc') + Cast(Coalesce(F('tz_offset'), 0), output_field=models.DurationField()) - timedelta(minutes=tz_minutes))
    
    def translate_timezone(self, image_ids, tz_minutes):
        images = Image.objects.filter(pk__in = image_ids, date_time_utc__isnull=False, tz_offset__isnull=False)
        # below should really just be F('tz_offset') + timedelta(minutes=tz_minutes) but then django seems to think the output needs to be a
        # DateTimeField and things get messed up.
        images.update(tz_offset = Cast(F('tz_offset'), output_field=models.IntegerField()) + Cast(timedelta(minutes=tz_minutes), output_field=models.IntegerField()), date_time_utc = F('date_time_utc') - timedelta(minutes=tz_minutes))
    
    def set_author(self, image_ids, author):
        self.logger.info(f"Setting author to '{author}' for images {image_ids}")
        images = Image.objects.filter(pk__in = image_ids)
        images.update(author=author)
    
    def geotag(self, image_ids, track_ids, overwrite):
        self.logger.info(f"Geotagging: {track_ids} for {image_ids} with overwrite {overwrite}")
        if overwrite:
            images = Image.objects.filter(pk__in = image_ids)
        else:
            images = Image.objects.filter(pk__in = image_ids, gps_longitude__isnull=True, gps_latitude__isnull=True, gps_altitude__isnull=True)
        
        faulty_images = []
        for image in images:
            if not has_timezone(image.date_time):
                faulty_images.append(image.name)
        if faulty_images:
            raise ImageSetActionError("Cannot geotag all images because some have no complete date/time set. Fix this first.", faulty_images)
        
        track_paths = []
        for track_id in track_ids:
            dir_id, file_name = track_id.split('/')
            dir = Directory.objects.get(pk=dir_id)
            track_paths.append(os.path.join(dir.get_absolute_path(), file_name))
        
        geo_context = GeotaggingService.instance().create_geotagging_context(track_paths)
        
        for image in images:
            lon, lat, alt = GeotaggingService.instance().geotag(image.date_time, geo_context)
            self.logger.info(f"Found coords {lon},{lat},{alt} for image {image}")
            image.gps_longitude=lon
            image.gps_latitude=lat
            image.gps_altitude=alt
            image.save()
    
    def set_coordinates(self, image_ids, latitude, longitude, overwrite):
        self.logger.info(f"Setting coordinates for {image_ids} with overwrite {overwrite} to {latitude}, {longitude}")
        if overwrite:
            images = Image.objects.filter(pk__in = image_ids)
        else:
            images = Image.objects.filter(pk__in = image_ids, gps_longitude__isnull=True, gps_latitude__isnull=True)
        
        images.update(gps_latitude=latitude, gps_longitude=longitude, gps_altitude=None)
