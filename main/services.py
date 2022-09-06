import os, logging

from .utils.exiftool_ctxmngr import ExifTool
from .model.metadata_parser import Metadata, FujiXT20ImageParser, FallbackImageParser
from .model.metadata_writer import JpegImageSerializer, MetadataType, OriginalFileSerializer, FujiRawImageSerializer, MovVideoSerializer
from .model.gps_track import GpsTrack, GpsTrackSection, GpxTrackParser, KmlTrackParser
from typing import List, Tuple
from datetime import datetime

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
                metadata = Metadata(image.date_time, None, image.author.name, image.gps_longitude, image.gps_latitude, image.gps_altitude)
                params = MetadataSerializerService.instance().serialize_metadata(ext, metadata);
                if params is not None:
                    et.execute("-overwrite_original", "-use", "MWG", "-preserve", *params, image.name)
                
                for att in image.attachments.all():
                    ext = os.path.splitext(att.name)[1]
                    params = MetadataSerializerService.instance().serialize_metadata(ext, metadata);
                    if params is not None:
                        et.execute("-overwrite_original", "-use", "MWG", "-preserve", *params, att.name)


class MetadataParserService:
    __instance = None

    @classmethod
    def instance(cls):
        if cls.__instance is not None:
            return cls.__instance
        else:
            cls.__instance = MetadataParserService()
            cls.__instance.logger = logging.getLogger(__name__)
            return cls.__instance

    def __init__(self):
        self.parsers = [FujiXT20ImageParser(), FallbackImageParser()]

    def parse_metadata(self, json: dict) -> Metadata:
        for p in self.parsers:
            if p.can_parse(json):
                return p.parse(json)
        self.logger.warn('No parser found for %s' % json);
        return Metadata(None, None, None, None, None, None)


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
        self.serializers = [JpegImageSerializer(), OriginalFileSerializer(), FujiRawImageSerializer(), MovVideoSerializer()]

    def serialize_metadata(self, extension, metadata: Metadata) -> list:
        for p in self.serializers:
            if p.can_serialize(extension):
                return p.serialize(metadata)
        raise ValueError("No serializer for file extension %s" % (extension))

    def supports_metadata_type(self, extension: str, type: MetadataType) -> bool:
        for p in self.serializers:
            if p.can_serialize(extension):
                return type in p.supported_metadata_types
        raise ValueError("No serializer for file extension %s" % (extension))

    def supported_metadata_types(self, extension: str) -> Tuple[MetadataType]:
        for p in self.serializers:
            if p.can_serialize(extension):
                return p.supported_metadata_types
        raise ValueError("No serializer for file extension %s" % (extension))


class GpsTrackParserService:
    __instance = None

    @classmethod
    def instance(cls):
        if cls.__instance is not None:
            return cls.__instance
        else:
            cls.__instance = GpsTrackParserService()
            return cls.__instance

    def __init__(self):
        self.parsers = [GpxTrackParser(), KmlTrackParser()]

    def parse_track(self, track_path: str) -> GpsTrack:
        extension = os.path.splitext(track_path)[1]
        for p in self.parsers:
            if p.can_parse(extension):
                return p.parse(track_path)
        return None


class GeotaggingService:
    __instance = None

    @classmethod
    def instance(cls):
        if cls.__instance is not None:
            return cls.__instance
        else:
            cls.__instance = GeotaggingService()
            return cls.__instance
    
    def create_geotagging_context(self, track_paths) -> List[GpsTrackSection]:
        result = []
        for track_path in track_paths:
            track = GpsTrackParserService.instance().parse_track(track_path)
            result.extend(track.sections)
        return result

    def geotag(self, timestamp: datetime, geo_context: List[GpsTrackSection]):
        # we iterate all sections, we look for a fix-pair that our timestamp falls in
        # we assign the pair [p_start, p_end] a weight:
        #    - a pair that stands still gets a very high weight
        #    - otherwise the weight is based on the time distances: [p_start, datetime] and [datetime, p_end]
        # TODO: do we want to extrapolate here?
        pairs = []
        for section in geo_context:
            for p_start, p_end in zip(section.gps_fixes, section.gps_fixes[1:]):
                if p_start.timestamp <= timestamp <= p_end.timestamp:
                    pairs.append((p_start, p_end))
        
        best_pair = None
        best_pair_weight = float("inf") # best weight is 0, worst Inf
        for p_start, p_end in pairs:
            weight = (timestamp - p_start.timestamp).total_seconds() * (p_end.timestamp - timestamp).total_seconds()
            if p_start.coordinate == p_end.coordinate:
                weight = 0
            print(p_start.timestamp, "-", timestamp, "-", p_end.timestamp, "-", weight)
            if(weight < best_pair_weight):
                best_pair_weight = weight
                best_pair = (p_start, p_end)

        if best_pair is not None:
            p_start = best_pair[0]
            p_end = best_pair[1]
            frac = (timestamp - p_start.timestamp).total_seconds() / (p_end.timestamp - p_start.timestamp).total_seconds()
            return (self.interpolate(p_start.coordinate.longitude, p_end.coordinate.longitude, frac),
                self.interpolate(p_start.coordinate.latitude, p_end.coordinate.latitude, frac),
                self.interpolate(p_start.coordinate.altitude, p_end.coordinate.altitude, frac))
        else:
            return (None, None, None)
    
    def interpolate(self, first, second, frac):
        if first is not None and second is not None and frac is not None:
            return first + frac * (second - first)
        else:
            return None