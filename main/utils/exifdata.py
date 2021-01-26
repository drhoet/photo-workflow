from datetime import datetime


def parse_file_filemodifytime(dt_str):
    return datetime.strptime(dt_str, "%Y:%m:%d %H:%M:%S%z")


def parse_exif_datetimeoriginal(dt_str):
    return datetime.strptime(dt_str, "%Y:%m:%d %H:%M:%S")


def parse_exif_offsettime(et_str):
    return datetime.strptime(et_str.replace(":", ""), "%z")


def isFujiXT20(json):
    return json.get("EXIF:Make", None) == "FUJIFILM" and json.get("EXIF:Model", None) == "X-T20"


def format_exif_datetimeoriginal(dt):
    return dt.strftime("%Y:%m:%d %H:%M:%S")


def format_exif_offsettime(dt):
    tz_str = dt.strftime("%z")  # this is in the format +0400
    return tz_str[0:3] + ":" + tz_str[3:]
