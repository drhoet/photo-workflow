# Generated by Django 3.1.5 on 2021-05-13 19:33

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0010_auto_20210404_0902'),
    ]

    operations = [
        migrations.AlterField(
            model_name='image',
            name='tz_offset_seconds',
            field=models.DurationField(null=True),
        ),
    ]
