from datetime import datetime, timezone
from .datetime import has_timezone

import logging

logger = logging.getLogger(__name__)

def parse_file_filemodifytime(dt_str: str) -> datetime:
    return datetime.strptime(dt_str, "%Y:%m:%d %H:%M:%S%z")


""" Returns a *naive* datetime (no timezone information) """
def parse_exif_datetimeoriginal(dt_str: str) -> datetime:
    try:
        return datetime.strptime(dt_str, "%Y:%m:%d %H:%M:%S")
    except ValueError:
        logger.warn(f"Could not parse {dt_str} to a valid naive date")
        return None


""" Returns a *full* datetime (including timezone information) """
def parse_exif_fulldatetime(dt_str: str) -> datetime:
    try:
        return datetime.strptime(dt_str, "%Y:%m:%d %H:%M:%S%z")
    except ValueError:
        logger.warn(f"Could not parse {dt_str} to a valid full date")
        return None


def parse_exif_offsettime(et_str: str) -> timezone:
    try:
        dt = datetime.strptime(et_str.replace(":", ""), "%z")
        if has_timezone(dt):
            return dt.tzinfo
        else:
            return None
    except ValueError:
        logger.warn(f"Could not parse {et_str} to a time offset")
        return None


def format_exif_datetimeoriginal(dt: datetime) -> str:
    return dt.strftime("%Y:%m:%d %H:%M:%S")


def format_exif_offsettime(dt: datetime) -> str:
    tz_str = dt.strftime("%z")  # this is in the format +0400
    return tz_str[0:3] + ":" + tz_str[3:]


def format_file_modify_date(dt: datetime) -> str:
    return format_exif_datetimeoriginal(dt) + format_exif_offsettime(dt)


def format_exif_fulldatetime(dt: datetime) -> str:
    return dt.strftime("%Y:%m:%d %H:%M:%S%z")