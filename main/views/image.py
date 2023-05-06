from django.http import HttpResponse, FileResponse
from django.views.generic import DetailView
from PIL import Image as PIL_Image, ImageOps as PIL_ImageOps
import os, ffmpeg

from main.models import Image


class ImageDownloadView(DetailView):
    model = Image

    def get(self, request, *args, **kwargs):
        image = self.get_object()
        src = os.path.join(image.parent.get_absolute_path(), image.name)

        if image.is_image:    
            pil_image = PIL_Image.open(src)
            pil_image = PIL_ImageOps.exif_transpose(pil_image)

            if "maxw" in request.GET and "maxh" in request.GET:
                max_width = int(request.GET.get("maxw", "250"))
                max_height = int(request.GET.get("maxh", "250"))

                width_percent = (max_width / float(pil_image.size[0]))
                height_percent = (max_height / float(pil_image.size[1]))

                percent = min(width_percent, height_percent)

                target_width = int((float(pil_image.size[0]) * float(percent)))
                target_height = int((float(pil_image.size[1]) * float(percent)))
                print("Resizing image %s to (%d, %d)" % (image.name, target_width, target_height))
                pil_image = pil_image.resize((target_width, target_height), PIL_Image.ANTIALIAS)

            response = HttpResponse(content_type="image/jpeg")
            pil_image.save(response, "JPEG")
            return response
        else:
            http_range = request.META.get('HTTP_RANGE')
            if http_range:
                with open(src, "rb") as f:
                    stat = os.fstat(f.fileno())
                    file_length = stat.st_size
                    start, end = http_range.split('=')[1].split('-')
                    if not start:
                        # handle the -x case, which wants to get the x last bytes
                        start = max(0, file_length - int(end))
                        end = ''
                    start, end = int(start), int(end or file_length - 1)
                    start = max(0, start)
                    end = min(end, file_length - 1, start + 5000000)
                    f.seek(start)
                    response = HttpResponse(content_type="video/mp4")
                    response.status_code = 206
                    response['Accept-Ranges'] = 'bytes'
                    response['Content-Length'] = end + 1 - start
                    response['Content-Range'] = f"bytes {start}-{end}/{file_length}"
                    c = start
                    while c < end:
                        buf = f.read(min(1024, end - c + 1))
                        c += len(buf)
                        response.write(buf)
                    return response
            else:
                response = FileResponse(open(src, "rb"), content_type="video/mp4")
                response['Accept-Ranges'] = 'bytes'
                return response
