from django.http import HttpResponseRedirect, HttpResponse
from django.urls import reverse
from django.views.generic import DetailView
from PIL import Image as PIL_Image
import os

from main.models import Image
from main.services import ExifToolService


class ImageDownloadView(DetailView):
    model = Image

    def get(self, request, *args, **kwargs):
        image = self.get_object()
        
        pil_image = PIL_Image.open(os.path.join(image.parent.get_absolute_path(), image.name))
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
