import logging
import re

from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from main.utils.exifdata import parse_exif_offsettime, parse_exif_datetimeoriginal, parse_file_filemodifytime, parse_exif_fulldatetime
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
    camera_manufacturer: str
    camera_model: str
    camera_serial: str
    original_file_name: str


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


class CameraMixin:
    def parse_manufacturer(self, json: dict) -> str:
        if "IFD0:Make" in json:
            return json["IFD0:Make"]
        else:
            return None

    def parse_model(self, json: dict) -> str:
        if "IFD0:Model" in json:
            return json["IFD0:Model"]
        else:
            return None

    def parse_serial(self, json: dict) -> str:
        if "ExifIFD:SerialNumber" in json:
            return json["ExifIFD:SerialNumber"]
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
            lr_tags = tag_val.split(",") if isinstance(tag_val, str) else tag_val
            lr_tags = map(lambda s: s.strip(), lr_tags)
            lr_tags = map(lambda s: s.replace('|', '/'), lr_tags)
            tags.extend(list(lr_tags))

        if "XMP-digiKam:TagsList" in json:
            tag_val = json["XMP-digiKam:TagsList"]
            self.logger.info(f'There is a value for XMP-digiKam:TagsList: {tag_val}')
            dk_tags = tag_val.split(",") if isinstance(tag_val, str) else tag_val
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


class OriginalFileNameMixin:
    def parse_original_file_name(self, json: dict) -> str:
        if "XMP-xmpMM:PreservedFileName" in json:
            return json["XMP-xmpMM:PreservedFileName"]
        else:
            return json["System:FileName"]


class DateTimeMwgMixin:
    def parse_date_time_mwg(self, json: dict) -> datetime:
        if "MWG:DateTimeOriginal" in json:
            return parse_exif_fulldatetime(json["MWG:DateTimeOriginal"])
        return None


class FujiXT20ImageParser(AuthorMixin, CameraMixin, RatingMixin, PickLabelMixin, ColorLabelMixin, TagsListMixin, GpsCoordinatesMixin, OriginalFileNameMixin, DateTimeMwgMixin, MetadataParser):
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def can_parse(self, json: dict) -> bool:
        return (
            json.get("File:FileType", None) in ["JPEG", "MOV"]
            and json.get("IFD0:Make", None) == "FUJIFILM"
            and json.get("IFD0:Model", None) == "X-T20"
        )

    def parse(self, json: dict) -> Metadata:
        self.logger.info(f"Parsing with FujiXT20ImageParser: {json['System:FileName']}")

        date_time_original = self.parse_date_time_mwg(json)
        if date_time_original is None and "ExifIFD:DateTimeOriginal" in json: # we don't use the MWG:DateTimeOriginal here since that one already uses the ExifIFD:OffsetDateTime to add the timezone
            date_time_original_naive = parse_exif_datetimeoriginal(json["ExifIFD:DateTimeOriginal"])
            self.logger.info(f'There is a value for ExifIFD:DateTimeOriginal: {date_time_original_naive}')

            # if we could not find the date_time of the picture, it makes no sense to figure out the offset...
            if date_time_original_naive is not None and "ExifIFD:OffsetTimeOriginal" in json:
                tz = parse_exif_offsettime(json["ExifIFD:OffsetTimeOriginal"])
                self.logger.info(f'There is a value for ExifIFD:OffsetTimeOriginal: {tz}')
                if tz is not None:
                    date_time_original = date_time_original_naive.replace(tzinfo=tz)

            if date_time_original is None and date_time_original_naive is not None and "ExifIFD:OffsetTime" in json:
                tz = parse_exif_offsettime(json["ExifIFD:OffsetTime"])
                self.logger.info(f'There is a value for ExifIFD:OffsetTime: {tz}')
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
                self.logger.info(f"We have a diff of {diff}")
                if abs(diff) >= 24*60*60:
                    self.logger.warn(f'The difference between DTO and FMD is bigger than 24h, cannot be a timezone difference. Not setting a timezone.')
                    date_time_original = date_time_original_naive
                elif diff % 1800 < accepted_delta or diff % 1800 > 1800 - accepted_delta:
                    timezone_half_hours = round((date_time_original_naive - fmd).total_seconds() / 1800)
                    tz = timezone(timedelta(seconds=timezone_half_hours * 1800))
                    date_time_original = date_time_original_naive.replace(tzinfo=tz)
                else:
                    self.logger.warn(f'The difference is too big: {diff}. Not setting a timezone.')
                    date_time_original = date_time_original_naive
        lon, lat, alt = self.parse_coordinates(json)
        return Metadata(date_time_original, self.parse_rating(json), self.parse_pick_label(json), self.parse_color_label(json), self.parse_tags(json),
            self.parse_author(json), lon, lat, alt, self.parse_manufacturer(json), self.parse_model(json), self.parse_serial(json),
            self.parse_original_file_name(json))


class FallbackImageParser(AuthorMixin, CameraMixin, RatingMixin, PickLabelMixin, ColorLabelMixin, TagsListMixin, GpsCoordinatesMixin, OriginalFileNameMixin, DateTimeMwgMixin, MetadataParser):
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def can_parse(self, json: dict) -> bool:
        return True

    def parse(self, json: dict) -> Metadata:
        self.logger.info(f"Parsing with FallbackImageParser: {json['System:FileName']}")

        date_time_original = self.parse_date_time_mwg(json)
        if date_time_original is None and "ExifIFD:DateTimeOriginal" in json:
            date_time_original_naive = parse_exif_datetimeoriginal(json["ExifIFD:DateTimeOriginal"])
            self.logger.info(f'There is a value for ExifIFD:DateTimeOriginal: {date_time_original_naive}')
            # if we could not find the date_time of the picture, it makes no sense to figure out the offset...
            if date_time_original_naive is not None and "ExifIFD:OffsetTimeOriginal" in json:
                tz = parse_exif_offsettime(json["ExifIFD:OffsetTimeOriginal"])
                self.logger.info(f'There is a value for ExifIFD:OffsetTimeOriginal: {tz}')
                if tz is not None:
                    date_time_original = date_time_original_naive.replace(tzinfo=tz)
            
            if date_time_original is None and date_time_original_naive is not None and "ExifIFD:OffsetTime" in json:
                tz = parse_exif_offsettime(json["ExifIFD:OffsetTime"])
                self.logger.info(f'There is a value for ExifIFD:OffsetTime: {tz}')
                if tz is not None:
                    date_time_original = date_time_original_naive.replace(tzinfo=tz)

            if date_time_original is None:
                self.logger.warn(f'No timezone information available for this file.')
                date_time_original = date_time_original_naive
        
        if date_time_original is None and "QuickTime:CreateDate" in json:
            date_time_original = parse_exif_datetimeoriginal(json["QuickTime:CreateDate"])
            self.logger.info(f'There is a value for QuickTime:CreateDate: {date_time_original}')

        if date_time_original is None and re.match(r'\w+_\d{8}_\d{6}[_\.].+', json['System:FileName']):
            m = re.match(r'\w+_(\d{8}_\d{6})[_\.].+', json['System:FileName'])
            date_time_original = datetime.strptime(m.group(1), '%Y%m%d_%H%M%S')
            self.logger.info(f'Parsed timestamp from filename: {date_time_original}')

        lon, lat, alt = self.parse_coordinates(json)
        return Metadata(date_time_original, self.parse_rating(json), self.parse_pick_label(json), self.parse_color_label(json), self.parse_tags(json),
            self.parse_author(json), lon, lat, alt, self.parse_manufacturer(json), self.parse_model(json), self.parse_serial(json),
            self.parse_original_file_name(json))
