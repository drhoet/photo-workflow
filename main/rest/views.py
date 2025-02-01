import sys, logging

from rest_framework import viewsets, generics, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.http import Http404
from django.shortcuts import get_object_or_404

from main.models import Directory, Image, Attachment, Author, Camera, ImageSetActionError, ImageSetService, MetadataIncompleteError, Tag, CameraMatcherService, StringSetting
from main.rest.serializers import DirectorySerializer, AuthorSerializer, CameraSerializer, AttachmentSerializer, DirectoryNestedSerializer, GpsTrackWithMetadataSerializer, TagSerializer

class AuthorListView(generics.ListAPIView):
    queryset = Author.objects.all()
    serializer_class = AuthorSerializer


class AuthorDetailView(generics.RetrieveAPIView):
    queryset = Author.objects.all()
    serializer_class = AuthorSerializer


class AttachmentDetailView(generics.RetrieveAPIView): 
    queryset = Attachment.objects.all()
    serializer_class = AttachmentSerializer


class TagTreeView(generics.ListAPIView):
    queryset = Tag.objects.filter(parent = None)
    serializer_class = TagSerializer


class TagDetailView(generics.RetrieveAPIView):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer


class TagActionsView(APIView):
    logger = logging.getLogger(__name__)

    def post(self, request, *args, **kwargs):
        try:
            action = request.POST["action"]
            parent = get_object_or_404(Tag, pk=kwargs.get("pk"))
            
            if action == "create_subtag":
                name = request.POST["name"]
                new_tag = Tag(parent = parent, name = name)
                new_tag.save()
            else:
                return Response({'message': "Unsupported action"}, 400)

            return Response({'result': 'OK'}, 200)
        except Exception as exc:
            self.logger.error(exc, exc_info=True)
            return Response({'message': "Unknown exception: " + getattr(exc, 'message', repr(exc))}, 500)


class CameraListView(generics.ListAPIView):
    queryset = Camera.objects.all()
    serializer_class = CameraSerializer


class RootListView(generics.ListAPIView):
    queryset = Directory.objects.filter(parent = None)
    serializer_class = DirectoryNestedSerializer


class DirectoryDetailView(generics.RetrieveAPIView):
    queryset = Directory.objects.all()
    serializer_class = DirectorySerializer


class ImageMetadataView(APIView):
    def get(self, request, *args, **kwargs):
        image = get_object_or_404(Image, pk=kwargs.get("pk"))
        return Response(image.read_exif_json_from_file())


class DirectoryCrumbsView(APIView):
    def get(self, request, *args, **kwargs):
        directory = get_object_or_404(Directory, pk=kwargs.get("pk"))
        breadcrumbs = [directory]
        cursor = directory.parent
        while cursor:
            breadcrumbs.insert(0, cursor)
            cursor = cursor.parent
        serializer = DirectoryNestedSerializer(breadcrumbs, many=True, context={'request': request})
        return Response(serializer.data)


class DirectoryActionsView(APIView):
    logger = logging.getLogger(__name__)

    def post(self, request, *args, **kwargs):
        try:
            directory = get_object_or_404(Directory, pk=kwargs.get("pk"))
            action = request.POST["action"]
            if action == "scan":
                reload = request.POST["reload"]
                CameraMatcherService.instance().reload_cameras()
                skip_dirs = StringSetting.objects.get_multiple(name="skip_dirs")
                directory.scan(reload == 'true', skip_dirs = skip_dirs)
            elif action == "rename_files":
                directory.rename_files()
            elif action == "write_metadata":
                 directory.write_images_metadata()
            elif action == "remove_dir_from_db":
                directory.remove_from_db()
            elif action == "trash_flagged_for_removal":
                directory.trash_flagged_for_removal()
            elif action == "trash_unstarred_raws":
                directory.trash_unstarred_raws()
            elif action == "trash_unstarred_videos":
                directory.trash_unstarred_videos()
            else:
                return Response({'message': "Unsupported action"}, 400)

            return Response({'result': 'OK'}, 200)
        except Http404:
            return Response({'message': "Not found"}, 404)
        except MetadataIncompleteError as exc:
            return Response(exc.as_dict(), 400)
        except Exception as exc:
            self.logger.error(exc, exc_info=True)
            return Response({'message': "Unknown exception: " + getattr(exc, 'message', repr(exc))}, 500)


class DirectoryTracksView(APIView):
    def get(self, request, *args, **kwargs):
        directory = get_object_or_404(Directory, pk=kwargs.get("pk"))
        serializer = GpsTrackWithMetadataSerializer(directory.parse_tracks(), many=True, context={'request': request})
        return Response(serializer.data)


class ImageSetActionsView(APIView):
    logger = logging.getLogger(__name__)

    def post(self, request, *args, **kwargs):
        try:
            action = request.POST["action"]
            if request.POST["ids"] is None:
                self.logger.info('No ids specified to do the action on. Just skipping...')
                return Response({'result': 'OK'}, 200)
            ids = request.POST["ids"].split(",")

            if action == "edit_timezone":
                mode = request.POST["mode"]
                value = int(request.POST["value"])
                named_zone = request.POST["namedZone"]
                if mode == "overwrite":
                    ImageSetService.instance().overwrite_timezone(ids, value)
                elif mode == "translate":
                    ImageSetService.instance().translate_timezone(ids, value)
                elif mode == "use-named-zone":
                    ImageSetService.instance().overwrite_timezone_with_named(ids, named_zone)
                else:
                    raise ValueError(f'Invalid mode: {mode}')
            elif action == "shift_time":
                minutes = int(request.POST["minutes"])
                ImageSetService.instance().shift_time(ids, minutes)
            elif action == "set_author":
                author = get_object_or_404(Author, pk=request.POST["author"])
                ImageSetService.instance().set_author(ids, author)
            elif action == "set_camera":
                camera = get_object_or_404(Camera, pk=request.POST["camera"])
                ImageSetService.instance().set_camera(ids, camera)
            elif action == "geotag":
                trackIds = request.POST["trackIds"].split(",")
                overwrite = request.POST["overwrite"].casefold() == 'true'
                ImageSetService.instance().geotag(ids, trackIds, overwrite)
            elif action == "set_coordinates":
                overwrite = request.POST["overwrite"].casefold() == 'true'
                lat = float(request.POST["lat"])
                lon = float(request.POST["lon"])
                ImageSetService.instance().set_coordinates(ids, lat, lon, overwrite)
            elif action == "set_rating":
                value = int(request.POST["value"])
                ImageSetService.instance().set_rating(ids, value)
            elif action == "set_pick_label":
                value = request.POST["value"]
                value = None if value == 'null' else value
                ImageSetService.instance().set_pick_label(ids, value)
            elif action == "set_color_label":
                value = request.POST["value"]
                value = None if value == 'null' else value
                ImageSetService.instance().set_color_label(ids, value)
            elif action == "set_tags":
                value = request.POST["tagIds"].split(",") if request.POST["tagIds"] else None
                ImageSetService.instance().set_tags(ids, value)
            elif action == "remove_from_db":
                ImageSetService.instance().remove_from_db(ids)
            elif action == "organize_into_directories":
                ImageSetService.instance().organize_in_directories(ids)
            else:
                return Response({'message': "Unsupported action"}, 400)

            return Response({'result': 'OK'}, 200)
        except ImageSetActionError as exc:
            return Response(exc.as_dict(), 400)
        except Exception as exc:
            self.logger.error(exc, exc_info=True)
            return Response({'message': "Unknown exception: " + getattr(exc, 'message', repr(exc))}, 500)