from django.db import models
from django.db.models import F
from django.db.models.functions import Coalesce, Cast
from django.utils.functional import cached_property
from django.dispatch import receiver
from datetime import datetime, timezone, timedelta
from django.core.files import File
from django.core.cache import caches
from pathlib import Path
import logging, time, os, pytz
from typing import List

from .services import ExifToolService, MetadataParserService, GpsTrackParserService, GeotaggingService, ThumbnailService
from .model.file_types import FileType
from .utils.datetime import has_timezone
from .utils.fs import rename_safely

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


class SettingsManager(models.Manager):
    def get_single(self, name):
        return self.get(name=name).value

    def get_multiple(self, name):
        return [s.value for s in self.filter(name=name)]


class StringSetting(models.Model):
    name = models.CharField(max_length=255)
    value = models.CharField(max_length=255)

    objects = SettingsManager()

    def __str__(self):
        return f"{self.name}={self.value}"


class Camera(models.Model):
    make = models.CharField(max_length=255, blank=True, null=True)
    model = models.CharField(max_length=255, blank=True, null=True)
    serial = models.CharField(max_length=255, blank=True, null=True)
    file_number_start_idx = models.PositiveSmallIntegerField()
    file_number_end_idx = models.PositiveSmallIntegerField()
    key = models.CharField(max_length=4)

    def matches(self, make: str, model: str, serial: str):
        score = 0
        if self.make:
            if self.make == make:
                score = score + 1
            else:
                return False, -1
        if self.model:
            if self.model == model:
                score = score + 1
            else:
                return False, -1
        if self.serial:
            if self.serial == serial:
                score = score + 1
            else:
                return False, -1
        return True, score

    def __str__(self):
        return f"{self.make if self.make else '*'}-{self.model if self.model else '*'}-{self.serial if self.serial else '*'} ({self.key})"


class Author(models.Model):
    name = models.CharField(max_length=255)

    def is_unknown(self):
        return self.name == "Unknown"

    def __str__(self):
        return self.name


class Tag(models.Model):
    logger = logging.getLogger(__name__)

    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.CASCADE, related_name="subtags")
    name = models.CharField(max_length=255)

    # cached property so it doesn't redo those DB queries all the time. If we want to refresh this, we can delete the property with `del full_name`
    @cached_property
    def full_name(self):
        if self.parent_id is None:
            return self.name
        else:
            # HACK! instead of getting the parent through the .parent reference here, we will get it from the cache.
            # By doing so, we will not do another DB lookup here. This avoids a LOT of lookups, since the parents
            # are now shared by all tags, even over multiple images. Since this property is also cached, this means
            # we make getting the full_name a lot quicker
            cache = caches['tags']
            if not self.parent_id in cache:
               cache.set(self.parent_id, self.parent, 30)
            cached_parent = cache.get(self.parent_id)
            return f"{cached_parent.full_name}/{self.name}"

    def __str__(self):
        return self.full_name

    @classmethod
    def find_hierarchical_tag(cls, parent, name):
        (first_section_name, _, remainder) = name.partition('/')
        first_section_tag = Tag.objects.get(parent = parent, name = first_section_name)
        if not first_section_tag:
            return None
        elif not remainder:
            return first_section_tag
        else:
            return Tag.find_hierarchical_tag(first_section_tag, remainder)


class Directory(models.Model):
    logger = logging.getLogger(__name__)

    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.CASCADE, related_name="subdirs")
    path = models.CharField(max_length=255)

    class Meta:
        ordering = ["path"]

    def scan(self, reload_metadata=False, skip_dirs = []):
        start = time.time()

        # if reload: remove all old information
        if reload_metadata:
            self.images.all().delete()
            self.subdirs.all().delete()

        # then scan for all contents and add them to the DB
        abs_path = self.get_absolute_path()
        contents = list(os.scandir(abs_path))
        new_images : List[Image] = []
        new_dirs : List[Directory] = []
        new_attachments : List[Attachment] = []

        # create sub-items (both images and subdirs)
        existing_images = self.images.values_list('name', flat=True)
        existing_dirs = self.subdirs.values_list('path', flat=True)
        for entry in contents:
            if self._is_image(entry) and not entry.name in existing_images:
                img = Image(parent=self, name=entry.name)
                new_images.append(img)
            elif entry.is_dir() and not entry.name in existing_dirs:
                if entry.name in skip_dirs:
                    print(f"Skipping dir {entry.name} because it is in the skip list")
                else:
                    new_dirs.append(Directory(parent=self, path=entry.name))


        # if we have new images, scan their metadata and create a thumbnail
        if new_images:
            json = ExifToolService.instance().read_metadata(self.get_absolute_path(), *new_images)
            for i, j in zip(new_images, json):
                i.load_metadata(j)
                i.create_dummy_thumbnail()

        Image.objects.bulk_create(new_images, batch_size=100)
        Directory.objects.bulk_create(new_dirs, batch_size=100)
        
        image_tags = [Image.tags.through(image_id=img.id, tag_id=tag.id) for img in new_images for tag in img._unsaved_tags]
        Image.tags.through.objects.bulk_create(image_tags, batch_size=100)

        # schedule refreshing thumbnails
        for i in new_images:
            i.refresh_thumbnail()

        # create attachments
        existing_images = self.images.all()
        for entry in contents:
            if self._is_attachment(entry):
                related_image = self._find_related_image(existing_images, entry.name)
                if related_image is not None and not related_image.attachments.filter(name=entry.name).exists():
                    att = Attachment(parent=related_image, name=entry.name, attachment_type=FileType.from_path(entry.path).name)
                    new_attachments.append(att)
        Attachment.objects.bulk_create(new_attachments, batch_size=100)

        for d in self.subdirs.all():
            d.scan(skip_dirs=skip_dirs) # don't set reload_metadata here because we deleted the subdirs above, no need to do that again

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
        contents = list(os.scandir(abs_path))

        result = []
        for entry in contents:
            track = GpsTrackParserService.instance().parse_track(entry.path)
            if track is not None:
                result.append({
                    "id": f"{self.id}/{entry.name}",
                    "display_name": entry.name,
                    "data": track
                })
        return result
    
    def trash_flagged_for_removal(self):
        os.makedirs(os.path.join(self.get_absolute_path(), 'trash'), exist_ok=True)
        for img in self.images.filter(pick_label = 'red'):
            rename_safely(os.path.join(self.get_absolute_path(), img.name), os.path.join(self.get_absolute_path(), 'trash', img.name))
            for att in img.attachments.all():
                rename_safely(os.path.join(self.get_absolute_path(), att.name), os.path.join(self.get_absolute_path(), 'trash', att.name))
            img.delete()

    def trash_unstarred_raws(self):
        os.makedirs(os.path.join(self.get_absolute_path(), 'trash'), exist_ok=True)
        for img in self.images.filter(rating = 0).exclude(color_label = 'red'):
            for att in img.attachments.filter(attachment_type = 'RAW'):
                rename_safely(os.path.join(self.get_absolute_path(), att.name), os.path.join(self.get_absolute_path(), 'trash', att.name))
                att.delete()
    
    def rename_files(self):
        idx = 0
        for img in self.images.all():
            idx = idx + 1
            img.rename_to_standard_format(idx)

    def _is_image(self, dirEntry):
        return dirEntry.is_file() and FileType.from_path(dirEntry.path) == FileType.MAIN_MEDIA

    def _is_attachment(self, dirEntry):
        return dirEntry.is_file() and FileType.from_path(dirEntry.path) != FileType.MAIN_MEDIA

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
    rating = models.IntegerField(null=False, default=0)
    pick_label = models.CharField(max_length=10, null=True) # red, yellow, green
    color_label = models.CharField(max_length=10, null=True) # red, orange, yellow, green, blue, magenta, gray, black, white
    tags = models.ManyToManyField(Tag, related_name='tags')
    camera = models.ForeignKey(Camera, on_delete=models.SET_NULL, null=True)
    original_file_name = models.CharField(max_length=255, null=True)

    class Meta:
        ordering = ["date_time_utc"]
    
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
        
        if metadata.rating is not None:
            self.rating = int(metadata.rating)
        
        if metadata.pick_label is not None:
            self.pick_label = metadata.pick_label
        
        if metadata.color_label is not None:
            self.color_label = metadata.color_label

        if metadata.date_time_original is not None:
            self.date_time_utc = metadata.date_time_original.astimezone(timezone.utc)
            if metadata.date_time_original.tzinfo is not None:
                self.tz_offset = metadata.date_time_original.tzinfo.utcoffset(metadata.date_time_original)
        
        if metadata.longitude is not None and metadata.latitude is not None:
            self.gps_longitude = metadata.longitude
            self.gps_latitude = metadata.latitude
            if metadata.altitude is not None:
                self.gps_altitude = metadata.altitude
        
        self._unsaved_tags = []
        if metadata.tags: # check for empty list
            for tag in metadata.tags:
                db_tag = Tag.find_hierarchical_tag(None, tag)
                if db_tag:
                    # cannot append to self.tags here, since this object is probably not saved to the DB yet, so does not have an id
                    self._unsaved_tags.append(db_tag)
        
        self.camera = CameraMatcherService.instance().find_matching_camera(metadata.camera_manufacturer, metadata.camera_model, metadata.camera_serial)
        self.logger.info(f'Picture taken by camera: {self.camera}')

        if metadata.original_file_name:
            self.original_file_name = metadata.original_file_name
        else:
            self.original_file_name = self.name

    def create_dummy_thumbnail(self):
        try:
            img_raw = ThumbnailService.instance().create_dummy_thumbnail()
            thumbnail_path = Path(f"{self.parent.id}/{self.name}").with_suffix('.jpg')
            self.thumbnail = File(img_raw, name=thumbnail_path)
        except Exception as err:
            self.logger.warn(f"Could not create thumbnail for {self.name}: {err}")

    def refresh_thumbnail(self):
        path = os.path.join(self.parent.get_absolute_path(), self.name)
        ThumbnailService.instance().create_thumbnail_async(path, self.thumbnail)
    
    def rename_to_standard_format(self, idx):
        if self.original_file_name and self.camera:
            if self.camera.file_number_end_idx > self.camera.file_number_start_idx:
                img_nb = self.original_file_name[self.camera.file_number_start_idx:self.camera.file_number_end_idx]
            else:
                alphabet = "0123456789abcdefghijklmnopqrstuvwxyz"
                base = len(alphabet)
                if idx > base * base:
                    raise ValueError("Index too high, can't support this in standard numbering")
                n = idx
                idx_str = ""
                while n:
                    n, t = divmod(n, base)
                    idx_str += alphabet[t]
                img_nb = f"{self.date_time.day:02d}{idx_str:0>2s}"
            ext = Path(self.original_file_name).suffix
            base_name = f"{self.date_time.strftime('%Y%m')}-{self.camera.key}-{img_nb}"
            old_name = self.name
            self.name = f"{base_name}{ext}"
            dir_path = self.parent.get_absolute_path()
            rename_safely(os.path.join(dir_path, old_name), os.path.join(dir_path, self.name))
            self.save()
            for att in self.attachments.all():
                att_ext = Path(att.name).suffix
                old_att_name = att.name
                att.name = f"{base_name}{att_ext}"
                rename_safely(os.path.join(dir_path, old_att_name), os.path.join(dir_path, att.name))
                att.save()

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
        categories_nb = 0
        places_nb = 0
        for tag in self.tags.all():
            if(tag.full_name.startswith("Categories/")):
                categories_nb = categories_nb + 1
            elif(tag.full_name.startswith("Places/")):
                places_nb = places_nb + 1
        if categories_nb == 0:
            res.append('Missing category')
        if places_nb != 1:
            res.append('Missing place')
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
    
    def overwrite_timezone_with_named(self, image_ids, named_zone):
        self.logger.info(f"Setting time zone to '{named_zone}' for images {image_ids}")
        images = Image.objects.filter(pk__in = image_ids, date_time_utc__isnull=False)
        tz = pytz.timezone(named_zone)
        for img in images:
            new_offset = tz.utcoffset(img.date_time_utc.replace(tzinfo=None), is_dst=True)
            if img.tz_offset != new_offset:
                if img.tz_offset:
                    img.date_time_utc = img.date_time_utc + img.tz_offset - new_offset
                else:
                    img.date_time_utc = img.date_time_utc - new_offset
                img.tz_offset = new_offset
                img.save()
    
    def shift_time(self, image_ids, minutes):
        images = Image.objects.filter(pk__in = image_ids, date_time_utc__isnull=False)
        images.update(date_time_utc = F('date_time_utc') + timedelta(minutes=minutes))

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

    def set_rating(self, image_ids, rating):
        self.logger.info(f"Setting rating for {image_ids} to {rating}")
        images = Image.objects.filter(pk__in = image_ids)
        images.update(rating = rating)
    
    def set_pick_label(self, image_ids, pick_label):
        self.logger.info(f"Setting PickLabel for {image_ids} to {pick_label}")
        images = Image.objects.filter(pk__in = image_ids)
        images.update(pick_label = pick_label)
    
    def set_color_label(self, image_ids, color_label):
        self.logger.info(f"Setting ColorLabel for {image_ids} to {color_label}")
        images = Image.objects.filter(pk__in = image_ids)
        images.update(color_label = color_label)

    def set_tags(self, image_ids, tagIds):
        self.logger.info(f"Setting Tags for {image_ids} to {tagIds}")
        tags = Tag.objects.filter(pk__in = tagIds) if tagIds else []
        images = Image.objects.filter(pk__in = image_ids)
        for image in images:
            image.tags.set(tags)
    
    def remove_from_db(self, image_ids):
        Image.objects.filter(pk__in = image_ids).delete()


class CameraMatcherService:
    __instance = None

    @classmethod
    def instance(cls):
        if cls.__instance is not None:
            return cls.__instance
        else:
            cls.__instance = CameraMatcherService()
            cls.__instance.logger = logging.getLogger(__name__)
            cls.__instance.camera_cache = []
            return cls.__instance

    def reload_cameras(self):
        self.camera_cache = [c for c in Camera.objects.all()]

    def find_matching_camera(self, manufacturer: str, model: str, serial: str):
        best_match = None
        best_match_score = -1
        
        for candidate in self.camera_cache:
            match, candidate_score = candidate.matches(manufacturer, model, serial)
            if match and candidate_score > best_match_score:
                best_match = candidate
                best_match_score = candidate_score
        return best_match if best_match_score > 0 else None