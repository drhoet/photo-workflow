import os
from enum import Enum

class FileType(Enum):
    MAIN_MEDIA = 1
    RAW = 2
    SIDECAR = 3
    UNKNOWN = 99

    # path MUST be a file path, otherwise the result is undefined!
    def from_path(path):
        ext = os.path.splitext(path)[1]
        if ext.casefold() in [".jpg", ".jpeg", ".mov", ".mp4"]:
            return FileType.MAIN_MEDIA
        if ext.casefold() in [".raf", ".orf", ".cr2"]:
            return FileType.RAW
        else:
            return FileType.UNKNOWN