"""Compile actual Android launcher resources with aapt2 (never hand-write ARSC)."""
from pathlib import Path
import subprocess
import tempfile
import zipfile
from xml.sax.saxutils import escape

from apk_signing import Entry


def launcher_entries(icon: Path, android_jar: Path, aapt2: Path, version_code: int, version_name: str):
    if not android_jar.is_file():
        raise RuntimeError(f'Android framework jar missing: {android_jar}; supply --android-jar')
    with tempfile.TemporaryDirectory(prefix='wop-launcher-') as directory:
        root = Path(directory)
        resource = root / 'res/drawable-nodpi/app_icon.png'
        resource.parent.mkdir(parents=True)
        resource.write_bytes(icon.read_bytes())
        manifest = root / 'AndroidManifest.xml'
        manifest.write_text(f'''<manifest xmlns:android="http://schemas.android.com/apk/res/android"
 package="com.pregames.warriorsofpersia" android:versionCode="{version_code}"
 android:versionName="{escape(version_name)}" android:installLocation="auto">
 <uses-sdk android:minSdkVersion="21" android:targetSdkVersion="28"/>
 <application android:label="Warriors of Persia 3D" android:hardwareAccelerated="true"
   android:icon="@drawable/app_icon">
  <activity android:name="com.pregames.warriorsofpersia.MainActivity"
    android:label="Warriors of Persia 3D" android:theme="@android:style/Theme.NoTitleBar.Fullscreen"
    android:screenOrientation="landscape" android:configChanges="keyboardHidden|orientation|screenSize"
    android:exported="true">
   <intent-filter><action android:name="android.intent.action.MAIN"/>
    <category android:name="android.intent.category.LAUNCHER"/></intent-filter>
  </activity>
 </application>
</manifest>''')
        compiled = root / 'resources.zip'
        output = root / 'linked.apk'
        subprocess.run([str(aapt2), 'compile', '--no-crunch', '--dir', str(root / 'res'), '-o', str(compiled)], check=True)
        subprocess.run([str(aapt2), 'link', '-I', str(android_jar), '--manifest', str(manifest), '-o', str(output), str(compiled)], check=True)
        with zipfile.ZipFile(output) as archive:
            names = [name for name in archive.namelist() if name == 'AndroidManifest.xml' or name == 'resources.arsc' or name.startswith('res/')]
            entries = [Entry(name, archive.read(name), compress=False) for name in names]
            packed_icon = next(archive.read(name) for name in names if name.endswith('app_icon.png'))
            if packed_icon != icon.read_bytes():
                raise RuntimeError('Launcher compilation altered selected icon bytes')
        return entries
