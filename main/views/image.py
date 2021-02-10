from django.http import HttpResponseRedirect, FileResponse
from django.urls import reverse
from django.views.generic import DetailView
import os

from main.models import Image
from main.services import ExifToolService


class ImageDetailView(DetailView):
    model = Image
    template_name = "main/img_detail.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        image = context["image"]
        context["metadata"] = ExifToolService.instance().read_metadata(image.parent.get_absolute_path(), image)[0]
        return context


    def post(self, request, pk):
        image = self.get_object()
        action = request.POST["action"]
        return HttpResponseRedirect(reverse("main:img_detail", args=(pk,)))

class ImageDownloadView(DetailView):
    model = Image

    def get(self, request, *args, **kwargs):
        image = self.get_object()
        return FileResponse(open(os.path.join(image.parent.get_absolute_path(), image.name), "rb"))
