import os
from enum import Enum

class FileType(Enum):
    MAIN_MEDIA = 1
    RAW = 2
    SIDECAR = 3
    UNKNOWN = 99

    def from_path(path):
        ext = os.path.splitext(path)[1]
        if os.path.isfile(path):
            if ext.lower() == ".jpg" or ext.lower() == ".jpeg" or ext.lower() == ".mov":
                return FileType.MAIN_MEDIA
            if ext.lower() == ".raf" or ext.lower() == ".orf":
                return FileType.RAW
            else:
                return FileType.UNKNOWN
        return None