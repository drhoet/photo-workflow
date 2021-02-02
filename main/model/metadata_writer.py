from.metadata_parser import Metadata
from main.utils.exifdata import format_exif_datetimeoriginal, format_exif_offsettime, format_file_modify_date

class JpegImageSerializer:
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
        if metadata.artist is not None and metadata.date_time_original is not None:
            params.append(f"-Copyright=Copyright © {metadata.date_time_original.year} Dries Hoet, all rights reserved.")
        return params

class OriginalFileSerializer:
    def can_serialize(self, extension) -> bool:
        return extension.lower().endswith("_original")

    def serialize(self, metadata: Metadata) -> list:
        return []

class FujiRawImageSerializer:
    def can_serialize(self, extension) -> bool:
        return ".raf" == extension.lower()

    def serialize(self, metadata: Metadata) -> list:
        params = []
        if metadata.date_time_original:
            params.append(f"-AllDates={format_exif_datetimeoriginal(metadata.date_time_original)}")
            params.append(f"-OffsetTimeOriginal={format_exif_offsettime(metadata.date_time_original)}")
            params.append(f"-FileModifyDate={format_file_modify_date(metadata.date_time_original)}")  # set file modify date to picture taken date
        return params