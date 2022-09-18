from.metadata_parser import Metadata
from main.utils.exifdata import format_exif_datetimeoriginal, format_exif_offsettime, format_file_modify_date, format_exif_fulldatetime
from enum import Enum, auto

class MetadataType(Enum):
    DATE_TIME = auto()
    RATING = auto()
    PICK_LABEL = auto()
    COLOR_LABEL = auto()
    TAGS = auto()
    ARTIST = auto()
    COORDINATES = auto()


class JpegImageSerializer:
    supported_metadata_types = (MetadataType.ARTIST, MetadataType.RATING, MetadataType.PICK_LABEL, MetadataType.COLOR_LABEL, MetadataType.TAGS, MetadataType.DATE_TIME, MetadataType.COORDINATES)

    def can_serialize(self, extension) -> bool:
        return extension.casefold() in [".jpeg", ".jpg"]

    def serialize(self, metadata: Metadata) -> list:
        params = []
        if metadata.artist is not None:
            params.append(f"-MWG:Creator={metadata.artist}")
        if metadata.rating is not None:
            params.append(f"-MWG:Rating={metadata.rating}")
        if metadata.pick_label is not None:
            params.append(f"-XMP-digiKam:PickLabel={metadata.pick_label}")
        else:
            params.append("-XMP-digiKam:PickLabel=")
        if metadata.color_label is not None:
            params.append(f"-XMP-digiKam:ColorLabel={metadata.color_label}")
        else:
            params.append(f"-XMP-digiKam:ColorLabel=")
        if metadata.date_time_original is not None:
            params.append(f"-AllDates={format_exif_datetimeoriginal(metadata.date_time_original)}")
            params.append(f"-ExifIFD:OffsetTimeOriginal={format_exif_offsettime(metadata.date_time_original)}")
            params.append(f"-System:FileModifyDate={format_file_modify_date(metadata.date_time_original)}")  # set file modify date to picture taken date
        if metadata.longitude is not None and metadata.latitude is not None:
            params.append(f"-GPSLongitude={metadata.longitude}")
            params.append(f"-GPSLatitude='{metadata.latitude}'")
            if metadata.altitude is not None:
                params.append(f"-GPSAltitude='{metadata.altitude}'")
        if metadata.artist is not None and metadata.date_time_original is not None:
            params.append(f"-MWG:Copyright=Copyright © {metadata.date_time_original.year} Dries Hoet, all rights reserved.")
        if metadata.tags:
            sorted_tags = sorted(metadata.tags)
            params.append(f"-XMP-digiKam:TagsList={', '.join(sorted_tags)}")
            params.append(f"-XMP-lr:HierarchicalSubject={', '.join(map(lambda t: t.replace('/', '|'), sorted_tags))}")
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
            params.append(f"-ExifIFD:OffsetTimeOriginal={format_exif_offsettime(metadata.date_time_original)}")
            params.append(f"-System:FileModifyDate={format_file_modify_date(metadata.date_time_original)}")  # set file modify date to picture taken date
        return params


class MovVideoSerializer:
    supported_metadata_types = (MetadataType.ARTIST, MetadataType.RATING, MetadataType.PICK_LABEL, MetadataType.COLOR_LABEL, MetadataType.TAGS, MetadataType.DATE_TIME, MetadataType.COORDINATES)

    def can_serialize(self, extension) -> bool:
        return ".mov" == extension.casefold()

    def serialize(self, metadata: Metadata) -> list:
        params = []
        if metadata.artist is not None:
            params.append(f"-MWG:Creator={metadata.artist}")
        
        if metadata.rating is not None:
            params.append(f"-MWG:Rating={metadata.rating}")
        
        if metadata.pick_label is not None:
            params.append(f"-XMP-digiKam:PickLabel={metadata.pick_label}")
        else:
            params.append("-XMP-digiKam:PickLabel=")
        
        if metadata.color_label is not None:
            params.append(f"-XMP-digiKam:ColorLabel={metadata.color_label}")
        else:
            params.append(f"-XMP-digiKam:ColorLabel=")
        
        if metadata.date_time_original is not None:
            # We cannot use -AllDates, because the quicktime:CreateDate and quicktime:ModifyDate do not support timezone, but UserData:DateTimeOriginal does.
            params.append(f"-CreateDate={format_exif_datetimeoriginal(metadata.date_time_original)}")
            params.append(f"-ModifyDate={format_exif_datetimeoriginal(metadata.date_time_original)}")
            params.append(f"-DateTimeOriginal={format_exif_fulldatetime(metadata.date_time_original)}")
            # The author of exiftool recommends writing the CreationDate in Keys
            params.append(f"-Keys:CreationDate={format_exif_fulldatetime(metadata.date_time_original)}")
            params.append(f"-System:FileModifyDate={format_file_modify_date(metadata.date_time_original)}")  # set file modify date to picture taken date
        
        # We should write the quicktime:GPSCoordinates tag, but for some reason that does not work, the below works
        if metadata.longitude is not None and metadata.latitude is not None:
            params.append(f"-GPSLongitude={metadata.longitude}")
            params.append(f"-GPSLatitude='{metadata.latitude}'")
            if metadata.altitude is not None:
                params.append(f"-GPSAltitude='{metadata.altitude}'")


        if metadata.artist is not None and metadata.date_time_original is not None:
            params.append(f"-MWG:Copyright=Copyright © {metadata.date_time_original.year} Dries Hoet, all rights reserved.")
        
        if metadata.tags:
            sorted_tags = sorted(metadata.tags)
            params.append(f"-XMP-digiKam:TagsList={', '.join(sorted_tags)}")
            params.append(f"-XMP-lr:HierarchicalSubject={', '.join(map(lambda t: t.replace('/', '|'), sorted_tags))}")
        return params