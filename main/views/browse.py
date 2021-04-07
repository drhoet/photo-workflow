from django.http import HttpResponseRedirect
from django.urls import reverse
from django.views.generic import DetailView

from main.models import Directory


class BrowseView(DetailView):
    model = Directory
    template_name = "main/browse.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        breadcrumbs = []
        cursor = context["directory"].parent
        while cursor:
            breadcrumbs.insert(0, cursor)
            cursor = cursor.parent
        context["breadcrumbs"] = breadcrumbs
        return context

    def post(self, request, pk):
        directory = self.get_object()
        action = request.POST["action"]
        if action == "scan":
            directory.scan(False)
        elif action == "organize_into_directories":
            directory.organize_into_directories()
            directory.scan(False)
        elif action == "reload_metadata":
            directory.scan(True)
        elif action == "complete_timestamps":
            return HttpResponseRedirect(reverse("main:complete_timestamps", args=(pk,)))
        elif action == "geotag":
            pass
        elif action == "set_author":
            return HttpResponseRedirect(reverse("main:dir_set_author", args=(pk,)))
        elif action == "write_metadata":
            directory.write_images_metadata()
        elif action == "remove_dir_from_db":
            parent_id = directory.parent.id
            directory.remove_from_db()
            return HttpResponseRedirect(reverse("main:browse", args=(parent_id,)))
        return HttpResponseRedirect(reverse("main:browse", args=(pk,)))
