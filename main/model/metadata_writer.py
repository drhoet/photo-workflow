from.metadata_parser import Metadata
from main.utils.exifdata import format_exif_datetimeoriginal, format_exif_offsettime, format_file_modify_date
from enum import Enum, auto

class MetadataType(Enum):
    DATE_TIME = auto()
    RATING = auto()
    ARTIST = auto()
    COORDINATES = auto()


class JpegImageSerializer:
    supported_metadata_types = (MetadataType.ARTIST, MetadataType.RATING, MetadataType.DATE_TIME, MetadataType.COORDINATES)

    def can_serialize(self, extension) -> bool:
        return ".jpeg" == extension.lower() or ".jpg" == extension.lower()

    def serialize(self, metadata: Metadata) -> list:
        params = []
        if metadata.artist is not None:
            params.append(f"-Artist={metadata.artist}")
        if metadata.rating is not None:
            params.append(f"-Rating={metadata.rating}")
        if metadata.date_time_original is not None:
            params.append(f"-AllDates={format_exif_datetimeoriginal(metadata.date_time_original)}")
            params.append(f"-OffsetTimeOriginal={format_exif_offsettime(metadata.date_time_original)}")
            params.append(f"-FileModifyDate={format_file_modify_date(metadata.date_time_original)}")  # set file modify date to picture taken date
        if metadata.longitude is not None and metadata.latitude is not None:
            params.append(f"-GPSLongitude={metadata.longitude} -GPSLatitude={metadata.latitude}")
            if metadata.altitude is not None:
                params.append(f"-GPSAltitude={metadata.altitude}")
        if metadata.artist is not None and metadata.date_time_original is not None:
            params.append(f"-Copyright=Copyright © {metadata.date_time_original.year} Dries Hoet, all rights reserved.")
        return params


class OriginalFileSerializer:
    supported_metadata_types = ()

    def can_serialize(self, extension) -> bool:
        return extension.lower().endswith("_original")

    def serialize(self, metadata: Metadata) -> list:
        return []
    

class FujiRawImageSerializer:
    supported_metadata_types = (MetadataType.DATE_TIME)

    def can_serialize(self, extension) -> bool:
        return ".raf" == extension.lower()

    def serialize(self, metadata: Metadata) -> list:
        params = []
        if metadata.date_time_original is not None:
            params.append(f"-AllDates={format_exif_datetimeoriginal(metadata.date_time_original)}")
            params.append(f"-OffsetTimeOriginal={format_exif_offsettime(metadata.date_time_original)}")
            params.append(f"-FileModifyDate={format_file_modify_date(metadata.date_time_original)}")  # set file modify date to picture taken date
        return params


class MovVideoSerializer:
    supported_metadata_types = ()

    def can_serialize(self, extension) -> bool:
        return ".mov" == extension.casefold()

    def serialize(self, metadata: Metadata) -> list:
        return []