import os

def rename_safely(src, dst):
    if src == dst:
        return
    if os.path.exists(dst):
        raise IOError(f'File already exists: {dst}')
    else:
        os.rename(src, dst)