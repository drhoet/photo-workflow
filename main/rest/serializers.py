from rest_framework import serializers
from main.models import Directory, Image, Author, Attachment

class AttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attachment
        fields = ['id', 'name', 'attachment_type']


class AttachmentNestedSerializer(serializers.HyperlinkedModelSerializer):
    url = serializers.HyperlinkedIdentityField(view_name='main:attachment-detail')

    class Meta:
        model = Attachment
        fields = ['id', 'url', 'name', 'attachment_type']


class AuthorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Author
        fields = ['id', 'name']


class AuthorNestedSerializer(serializers.HyperlinkedModelSerializer):
    url = serializers.HyperlinkedIdentityField(view_name='main:author-detail')

    class Meta:
        model = Author
        fields = ['id', 'url', 'name']


class ImageNestedSerializer(serializers.HyperlinkedModelSerializer):
    url = serializers.HyperlinkedIdentityField(view_name='main:image-detail')
    author = AuthorNestedSerializer(read_only=True)
    attachments = AttachmentNestedSerializer(many=True)
    date_time = serializers.SerializerMethodField()

    class Meta:
        model = Image
        fields = ['id', 'url', 'name', 'author', 'date_time', 'errors', 'attachments']
    
    def get_date_time(self, obj):
        return obj.date_time.isoformat()


class DirectoryNestedSerializer(serializers.HyperlinkedModelSerializer):
    url = serializers.HyperlinkedIdentityField(view_name='main:directory-detail')

    class Meta:
        model = Directory
        fields = ['id', 'url', 'path']


class ImageSerializer(serializers.HyperlinkedModelSerializer):
    parent = DirectoryNestedSerializer(read_only=True)
    author = AuthorNestedSerializer(read_only=True)
    attachments = AttachmentNestedSerializer(many=True)

    class Meta:
        model = Image
        fields = ['id', 'name', 'parent', 'author', 'attachments', 'date_time_utc', 'tz_offset', 'errors']


class DirectorySerializer(serializers.HyperlinkedModelSerializer):
    parent = DirectoryNestedSerializer(read_only=True)
    images = ImageNestedSerializer(many=True)
    subdirs = DirectoryNestedSerializer(many=True)

    class Meta:
        model = Directory
        fields = ['id', 'parent', 'path', 'images', 'subdirs']
