from os.path import isdir

from .utils.exiftool_ctxmngr import ExifTool
from .utils.exifdata import format_exif_datetimeoriginal, format_exif_offsettime
from main.model.metadata_parser import Metadata, FujiXT20ImageParser


class ExifToolService(object):
    __instance = None

    @classmethod
    def instance(cls):
        if cls.__instance is not None:
            return cls.__instance
        else:
            cls.__instance = ExifToolService()
            return cls.__instance

    def organize_into_directories(self, path):
        if not isdir(path):
            raise ValueError("path is not a directory: %s" % path)

        with ExifTool(path) as et:
            et.execute("-Directory<DateTimeOriginal", "-dateFormat", "%Y-%m-%d", ".")

    def read_metadata(self, path, *files):
        if not isdir(path):
            raise ValueError("path is not a file: %s" % path)

        with ExifTool(path) as et:
            return et.get_metadata(*files)

    def write_metadata(self, path, *images):
        with ExifTool(path) as et:
            for image in images:
                params = []
                if image.author is not None and not image.author.is_unknown():
                    params.append(f"-Artist={image.author.name}")
                if image.date_time:
                    params.append(f"-DateTimeOriginal={format_exif_datetimeoriginal(image.date_time)}")
                    params.append(f"-OffsetTime={format_exif_offsettime(image.date_time)}")
                if params:
                    et.execute("-overwrite_original", "-use", "MWG", "-preserve", *params, image.name)


class MetadataParserService:
    __instance = None

    @classmethod
    def instance(cls):
        if cls.__instance is not None:
            return cls.__instance
        else:
            cls.__instance = MetadataParserService()
            return cls.__instance

    def __init__(self):
        self.parsers = [FujiXT20ImageParser()]

    def parse_metadata(self, json: dict) -> Metadata:
        for p in self.parsers:
            if p.can_parse(json):
                return p.parse(json)
        return Metadata(None, None, None)