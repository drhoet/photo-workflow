import os

from .utils.exiftool_ctxmngr import ExifTool
from main.model.metadata_parser import Metadata, FujiXT20ImageParser
from main.model.metadata_writer import JpegImageSerializer, OriginalFileSerializer, FujiRawImageSerializer


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
        if not os.path.isdir(path):
            raise ValueError("path is not a directory: %s" % path)

        with ExifTool(path) as et:
            et.execute("-Directory<DateTimeOriginal", "-dateFormat", "%Y-%m-%d", ".")

    def read_metadata(self, path, *images):
        if not os.path.isdir(path):
            raise ValueError("path is not a directory: %s" % path)

        files = [img.name for img in images]
        with ExifTool(path) as et:
            return et.get_metadata(*files)

    def write_metadata(self, path, *images):
        if not os.path.isdir(path):
            raise ValueError("path is not a directory: %s" % path)

        with ExifTool(path) as et:
            for image in images:
                ext = os.path.splitext(image.name)[1]
                metadata = Metadata(image.date_time, None, image.author.name)
                params = MetadataSerializerService.instance().serialize_metadata(ext, metadata);
                if params:
                    et.execute("-overwrite_original", "-use", "MWG", "-preserve", *params, image.name)
                
                for att in image.attachments.all():
                    ext = os.path.splitext(att.name)[1]
                    params = MetadataSerializerService.instance().serialize_metadata(ext, metadata);
                    if params:
                        et.execute("-overwrite_original", "-use", "MWG", "-preserve", *params, att.name)


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


class MetadataSerializerService:
    __instance = None

    @classmethod
    def instance(cls):
        if cls.__instance is not None:
            return cls.__instance
        else:
            cls.__instance = MetadataSerializerService()
            return cls.__instance

    def __init__(self):
        self.serializers = [JpegImageSerializer(), OriginalFileSerializer(), FujiRawImageSerializer()]

    def serialize_metadata(self, extension, metadata: Metadata) -> list:
        for p in self.serializers:
            if p.can_serialize(extension):
                return p.serialize(metadata)
        raise ValueError("No serializer for file extension %s" % (extension))