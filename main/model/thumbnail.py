import logging

from PIL import Image as PIL_Image, ImageOps as PIL_ImageOps
from io import BytesIO
import ffmpeg

class ImageThumbnailCreator:
    logger = logging.getLogger(__name__)

    def can_thumbnail(self, extension: str) -> bool:
        return extension.casefold() in [".jpeg", ".jpg"]

    def create_dummy_thumbnail(self) -> BytesIO:
        pil_image = PIL_Image.open('main/loading.jpg')
        img_raw = BytesIO()
        pil_image.save(img_raw, "JPEG")
        return img_raw

    def create_thumbnail(self, path: str, width: int, height: int) -> BytesIO:
        pil_image = PIL_Image.open(path)
        pil_image = PIL_ImageOps.exif_transpose(pil_image)
        
        width_percent = (width / float(pil_image.size[0]))
        height_percent = (height / float(pil_image.size[1]))

        percent = min(width_percent, height_percent)

        target_width = int((float(pil_image.size[0]) * float(percent)))
        target_height = int((float(pil_image.size[1]) * float(percent)))
        self.logger.info(f"Resizing image {path} to ({target_width}, {target_height})")
        pil_image = pil_image.resize((target_width, target_height), PIL_Image.ANTIALIAS)

        img_raw = BytesIO()
        pil_image.save(img_raw, "JPEG")
        return img_raw


class VideoThumbnailCreator:
    logger = logging.getLogger(__name__)

    def can_thumbnail(self, extension: str) -> bool:
        return extension.casefold() in [".mov", ".mp4"]
    
    def create_thumbnail(self, path: str, width: int, height: int) -> BytesIO:
        probe = ffmpeg.probe(path)
        time = float(probe['streams'][0]['duration']) // 2

        overlay_file = ffmpeg.input('main/film_overlay.png')
        (out, err) = (
            ffmpeg
                .input(path, ss=time)
                .filter('scale', width, height, force_original_aspect_ratio='decrease')
                .filter('pad', width, height, '(ow-iw)/2', '(oh-ih)/2')
                .overlay(overlay_file)
                .output('pipe:', format='singlejpeg', vframes=1)
                .run(capture_stdout=True, capture_stderr=True)
        )
        self.logger.debug(err)
        return BytesIO(out)
