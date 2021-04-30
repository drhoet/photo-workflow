from django.http import HttpResponseRedirect, FileResponse
from django.urls import reverse
from django.views.generic import DetailView
import os

from main.models import Image
from main.services import ExifToolService


class ImageDownloadView(DetailView):
    model = Image

    def get(self, request, *args, **kwargs):
        image = self.get_object()
        return FileResponse(open(os.path.join(image.parent.get_absolute_path(), image.name), "rb"))
