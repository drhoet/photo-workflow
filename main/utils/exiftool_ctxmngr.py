# https://stackoverflow.com/questions/10075115/call-exiftool-from-a-python-script

import subprocess
import os
import json
import logging


class ExifTool(object):

    sentinel = "{ready}\n"

    def __init__(self, working_dir, executable="/usr/local/bin/exiftool"):
        self.logger = logging.getLogger(__name__)
        self.executable = executable
        self.working_dir = working_dir

    def __enter__(self):
        self.process = subprocess.Popen(
            [self.executable, "-stay_open", "True", "-@", "-"],
            universal_newlines=True,
            cwd=self.working_dir,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
        )
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.process.stdin.write("-stay_open\nFalse\n")
        self.process.stdin.flush()

    def execute(self, *args):
        args = args + ("-execute\n",)
        self.logger.debug(args)
        self.process.stdin.write(str.join("\n", args))
        self.process.stdin.flush()
        output = ""
        fd = self.process.stdout.fileno()
        while not output.endswith(self.sentinel):
            blk = os.read(fd, 4096).decode("utf-8")
            self.logger.debug(blk)
            output += blk
        return output[: -len(self.sentinel)]

    def get_metadata(self, *filenames):
        return json.loads(self.execute("-G", "-j", "-n", *filenames))
