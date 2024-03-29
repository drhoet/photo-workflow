# Generated by Django 4.1 on 2023-01-01 15:15

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0022_camera_file_number_end_idx_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='StringSetting',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255)),
                ('value', models.CharField(max_length=255)),
            ],
        ),
        migrations.AlterModelOptions(
            name='image',
            options={'ordering': ['date_time_utc']},
        ),
    ]
