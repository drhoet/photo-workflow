from django.http import HttpResponseRedirect
from django.urls import reverse
from django.views.generic import DetailView

from main.models import Directory


class BrowseView(DetailView):
    model = Directory
    template_name = "main/browse.html"

    def post(self, request, pk):
        directory = self.get_object()
        action = request.POST["action"]
        if action == "scan":
            directory.scan()
        elif action == "organize_into_directories":
            directory.organize_into_directories()
            directory.scan()
        elif action == "complete_timestamps":
            return HttpResponseRedirect(reverse("main:complete_timestamps", args=(pk,)))
        elif action == "geotag":
            pass
        elif action == "set_author":
            return HttpResponseRedirect(reverse("main:dir_set_author", args=(pk,)))
        elif action == "write_metadata":
            directory.write_images_metadata()
        return HttpResponseRedirect(reverse("main:browse", args=(pk,)))
