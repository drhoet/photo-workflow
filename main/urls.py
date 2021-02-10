from django.urls import path
from .views import index, browse, complete_timestamps, author, image

app_name = "main"
urlpatterns = [
    path("", index.IndexView.as_view(), name="index"),
    path("dir/<int:pk>/browse", browse.BrowseView.as_view(), name="browse"),
    path(
        "dir/<int:pk>/complete_timestamps",
        complete_timestamps.CompleteTimestampsView.as_view(),
        name="complete_timestamps",
    ),
    path("dir/<int:dir_id>/set_author", author.SelectAuthorView.as_view(), name="dir_set_author"),
    path("img/<int:pk>/detail", image.ImageDetailView.as_view(), name="img_detail"),
    path("img/<int:pk>/download", image.ImageDownloadView.as_view(), name="img_download"),
]
