import logging

from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from main.utils.exifdata import parse_exif_offsettime, parse_exif_datetimeoriginal, parse_file_filemodifytime
from typing import Tuple, Set

@dataclass
class Metadata:
    date_time_original: datetime
    rating: int
    pick_label: str
    color_label: str
    tags: Set[str]
    artist: str
    longitude: float
    latitude: float
    altitude: float


class MetadataParser:
    def can_parse(self, json: dict) -> bool:
        raise NotImplementedError

    def parse(self, json: dict) -> Metadata:
        raise NotImplementedError


class AuthorMixin:
    def parse_author(self, json: dict) -> str:
        if "MWG:Creator" in json:
            return json["MWG:Creator"]
        else:
            return None


class RatingMixin:
    def parse_rating(self, json: dict) -> int:
        if "MWG:Rating" in json:
            return json["MWG:Rating"]
        else:
            return None


class PickLabelMixin:
    def parse_pick_label(self, json: dict) -> int:
        if "XMP-digiKam:PickLabel" in json:
            return json["XMP-digiKam:PickLabel"]
        else:
            return None


class ColorLabelMixin:
    def parse_color_label(self, json: dict) -> int:
        if "XMP-digiKam:ColorLabel" in json:
            return json["XMP-digiKam:ColorLabel"]
        else:
            return None


class TagsListMixin:
    def __init__(self):
        self.logger = logging.getLogger(__name__)

    def parse_tags(self, json: dict) -> str:
        tags = []
        if "XMP-lr:HierarchicalSubject" in json:
            tag_val = json["XMP-lr:HierarchicalSubject"]
            self.logger.info(f'There is a value for XMP-lr:HierarchicalSubject: {tag_val}')
            lr_tags = tag_val.split(",")
            lr_tags = map(lambda s: s.strip(), lr_tags)
            lr_tags = map(lambda s: s.replace('|', '/'), lr_tags)
            tags.extend(list(lr_tags))

        if "XMP-digiKam:TagsList" in json:
            tag_val = json["XMP-digiKam:TagsList"]
            self.logger.info(f'There is a value for XMP-digiKam:TagsList: {tag_val}')
            dk_tags = tag_val.split(",")
            dk_tags = map(lambda s: s.strip(), dk_tags)
            tags.extend(list(dk_tags))
        
        tags_set = set(tags) if tags else None
        self.logger.info(f'All parsed tags: {tags_set}')
        return tags_set


class GpsCoordinatesMixin:
    def parse_coordinates(self, json: dict) -> Tuple[float, float, float]:
        lat = json["GPS:GPSLatitude"] if "GPS:GPSLatitude" in json else None
        lon = json["GPS:GPSLongitude"] if "GPS:GPSLongitude" in json else None
        alt = json["GPS:GPSAltitude"] if "GPS:GPSAltitude" in json else None
        return (lon, lat, alt)


class FujiXT20ImageParser(AuthorMixin, RatingMixin, PickLabelMixin, ColorLabelMixin, TagsListMixin, GpsCoordinatesMixin, MetadataParser):
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def can_parse(self, json: dict) -> bool:
        return (
            json.get("File:FileType", None) == "JPEG"
            and json.get("IFD0:Make", None) == "FUJIFILM"
            and json.get("IFD0:Model", None) == "X-T20"
        )

    def parse(self, json: dict) -> Metadata:
        self.logger.info('Parsing with FujiXT20ImageParser')
        date_time_original = None
        if "ExifIFD:DateTimeOriginal" in json: # we don't use the MWG:DateTimeOriginal here since that one already uses the ExifIFD:OffsetDateTime to add the timezone
            date_time_original_naive = parse_exif_datetimeoriginal(json["ExifIFD:DateTimeOriginal"])
            self.logger.info(f'There is a value for ExifIFD:DateTimeOriginal: {date_time_original_naive}')

            # if we could not find the date_time of the picture, it makes no sense to figure out the offset...
            if "ExifIFD:OffsetTimeOriginal" in json:
                tz = parse_exif_offsettime(json["ExifIFD:OffsetTimeOriginal"])
                self.logger.info(f'There is a value for ExifIFD:OffsetTimeOriginal: {tz}')
                if tz is not None:
                    date_time_original = date_time_original_naive.replace(tzinfo=tz)
            
            if date_time_original is None:
                # see if we can find the timezone as the difference between the fileModifyDate (which seems to be in UTC always)
                # and the date_time
                fmd_str = json["System:FileModifyDate"]
                fmd = parse_file_filemodifytime(fmd_str).astimezone(timezone.utc).replace(tzinfo=None)
                self.logger.info(f'Guessing the timezone based on the FileModifyDate: {fmd_str} -- {fmd}')
                accepted_delta = 15.0  # diff should be whole half-hours, we accept 15s distance
                if "ExifIFD:ExposureTime" in json:
                    # on FUJI, the DateTimeOriginal is the moment the shutter is pressed. With long exposure times, this means
                    # the difference between DateTimeOriginal and FileModifyDate (i.e. the time the file was written), gets bigger,
                    # 2x the exposure time in fact (because it does the 'calculation' after the first exposure time)
                    accepted_delta = accepted_delta + 2 * json["ExifIFD:ExposureTime"]
                    self.logger.info(f'There is a value for ExifIFD:ExposureTime. We will use a bigger accepted_delta: {accepted_delta}')
                diff = abs((date_time_original_naive - fmd).total_seconds())
                if diff % 1800 < accepted_delta or diff % 1800 > 1800 - accepted_delta:
                    timezone_half_hours = round((date_time_original_naive - fmd).total_seconds() / 1800)
                    tz = timezone(timedelta(seconds=timezone_half_hours * 1800))
                    date_time_original = date_time_original_naive.replace(tzinfo=tz)
                else:
                    self.logger.warn(f'The difference is too big: {diff}. Not setting a timezone.')
                    date_time_original = date_time_original_naive
        lon, lat, alt = self.parse_coordinates(json)
        return Metadata(date_time_original, self.parse_rating(json), self.parse_pick_label(json), self.parse_color_label(json), self.parse_tags(json), self.parse_author(json), lon, lat, alt)


class FallbackImageParser(AuthorMixin, RatingMixin, PickLabelMixin, ColorLabelMixin, TagsListMixin, GpsCoordinatesMixin, MetadataParser):
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def can_parse(self, json: dict) -> bool:
        return True

    def parse(self, json: dict) -> Metadata:
        self.logger.info('Parsing with FallbackImageParser')
        date_time_original = None

        if "ExifIFD:DateTimeOriginal" in json:
            date_time_original_naive = parse_exif_datetimeoriginal(json["ExifIFD:DateTimeOriginal"])
            self.logger.info(f'There is a value for ExifIFD:DateTimeOriginal: {date_time_original_naive}')
            # if we could not find the date_time of the picture, it makes no sense to figure out the offset...
            if "ExifIFD:OffsetTimeOriginal" in json:
                tz = parse_exif_offsettime(json["ExifIFD:OffsetTimeOriginal"])
                self.logger.info(f'There is a value for ExifIFD:OffsetTimeOriginal: {tz}')
                if tz is not None:
                    date_time_original = date_time_original_naive.replace(tzinfo=tz)
            
            if date_time_original is None:
                self.logger.warn(f'No timezone information available for this file.')
                date_time_original = date_time_original_naive
        lon, lat, alt = self.parse_coordinates(json)
        return Metadata(date_time_original, self.parse_rating(json), self.parse_pick_label(json), self.parse_color_label(json), self.parse_tags(json), self.parse_author(json), lon, lat, alt)
