from datetime import datetime, timezone
from .datetime import has_timezone


def parse_file_filemodifytime(dt_str: str) -> datetime:
    return datetime.strptime(dt_str, "%Y:%m:%d %H:%M:%S%z")


def parse_exif_datetimeoriginal(dt_str: str) -> datetime:
    """ Returns a *naive* datetime (no timezone information) """
    return datetime.strptime(dt_str, "%Y:%m:%d %H:%M:%S")


def parse_exif_offsettime(et_str: str) -> timezone:
    dt = datetime.strptime(et_str.replace(":", ""), "%z")
    if has_timezone(dt):
        return dt.tzinfo
    else:
        return None


def format_exif_datetimeoriginal(dt: datetime) -> str:
    return dt.strftime("%Y:%m:%d %H:%M:%S")


def format_exif_offsettime(dt) -> str:
    tz_str = dt.strftime("%z")  # this is in the format +0400
    return tz_str[0:3] + ":" + tz_str[3:]
