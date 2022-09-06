import logging

from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from main.utils.exifdata import parse_exif_offsettime, parse_exif_datetimeoriginal, parse_file_filemodifytime
from typing import Tuple

@dataclass
class Metadata:
    date_time_original: datetime
    rating: int
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
        if "EXIF:Artist" in json:
            return json["EXIF:Artist"]
        else:
            return None


class RatingMixin:
    def parse_rating(self, json: dict) -> int:
        if "EXIF:Rating" in json:
            return json["EXIF:Rating"]
        else:
            return None


class GpsCoordinatesMixin:
    def parse_coordinates(self, json: dict) -> Tuple[float, float, float]:
        lat = json["EXIF:GPSLatitude"] if "EXIF:GPSLatitude" in json else None
        lon = json["EXIF:GPSLongitude"] if "EXIF:GPSLongitude" in json else None
        alt = json["EXIF:GPSAltitude"] if "EXIF:GPSAltitude" in json else None
        return (lon, lat, alt)


class FujiXT20ImageParser(AuthorMixin, RatingMixin, GpsCoordinatesMixin, MetadataParser):
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def can_parse(self, json: dict) -> bool:
        return (
            json.get("File:FileType", None) == "JPEG"
            and json.get("EXIF:Make", None) == "FUJIFILM"
            and json.get("EXIF:Model", None) == "X-T20"
        )

    def parse(self, json: dict) -> Metadata:
        self.logger.info('Parsing with FujiXT20ImageParser')
        date_time_original = None
        if "EXIF:DateTimeOriginal" in json:
            date_time_original_naive = parse_exif_datetimeoriginal(json["EXIF:DateTimeOriginal"])
            self.logger.info(f'There is a value for EXIF:DateTimeOriginal: {date_time_original_naive}')

            # if we could not find the date_time of the picture, it makes no sense to figure out the offset...
            if "EXIF:OffsetTime" in json:
                tz = parse_exif_offsettime(json["EXIF:OffsetTime"])
                self.logger.info(f'There is a value for EXIF:OffsetTime: {tz}')
                if tz is not None:
                    date_time_original = date_time_original_naive.replace(tzinfo=tz)
            
            if date_time_original is None:
                # see if we can find the timezone as the difference between the fileModifyDate (which seems to be in UTC always)
                # and the date_time
                fmd_str = json["File:FileModifyDate"]
                fmd = parse_file_filemodifytime(fmd_str).astimezone(timezone.utc).replace(tzinfo=None)
                self.logger.info(f'Guessing the timezone based on the FileModifyDate: {fmd_str} -- {fmd}')
                accepted_delta = 15.0  # diff should be whole half-hours, we accept 15s distance
                if "EXIF:ExposureTime" in json:
                    # on FUJI, the DateTimeOriginal is the moment the shutter is pressed. With long exposure times, this means
                    # the difference between DateTimeOriginal and FileModifyDate (i.e. the time the file was written), gets bigger,
                    # 2x the exposure time in fact (because it does the 'calculation' after the first exposure time)
                    accepted_delta = accepted_delta + 2 * json["EXIF:ExposureTime"]
                    self.logger.info(f'There is a value for EXIF:ExposureTime. We will use a bigger accepted_delta: {accepted_delta}')
                diff = abs((date_time_original_naive - fmd).total_seconds())
                if diff % 1800 < accepted_delta or diff % 1800 > 1800 - accepted_delta:
                    timezone_half_hours = round((date_time_original_naive - fmd).total_seconds() / 1800)
                    tz = timezone(timedelta(seconds=timezone_half_hours * 1800))
                    date_time_original = date_time_original_naive.replace(tzinfo=tz)
                else:
                    self.logger.warn(f'The difference is too big: {diff}. Not setting a timezone.')
                    date_time_original = date_time_original_naive
        lon, lat, alt = self.parse_coordinates(json)
        return Metadata(date_time_original, self.parse_rating(json), self.parse_author(json), lon, lat, alt)


class FallbackImageParser(AuthorMixin, RatingMixin, GpsCoordinatesMixin, MetadataParser):
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def can_parse(self, json: dict) -> bool:
        return True

    def parse(self, json: dict) -> Metadata:
        self.logger.info('Parsing with FallbackImageParser')
        date_time_original = None

        if "EXIF:DateTimeOriginal" in json:
            date_time_original_naive = parse_exif_datetimeoriginal(json["EXIF:DateTimeOriginal"])
            self.logger.info(f'There is a value for EXIF:DateTimeOriginal: {date_time_original_naive}')
            # if we could not find the date_time of the picture, it makes no sense to figure out the offset...
            if "EXIF:OffsetTime" in json:
                tz = parse_exif_offsettime(json["EXIF:OffsetTime"])
                self.logger.info(f'There is a value for EXIF:OffsetTime: {tz}')
                if tz is not None:
                    date_time_original = date_time_original_naive.replace(tzinfo=tz)
            
            if date_time_original is None:
                self.logger.warn(f'No timezone information available for this file.')
                date_time_original = date_time_original_naive
        lon, lat, alt = self.parse_coordinates(json)
        return Metadata(date_time_original, self.parse_rating(json), self.parse_author(json), lon, lat, alt)
