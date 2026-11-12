import io
import tempfile
import unittest
from pathlib import Path
import numpy as np
from PIL import Image
from optimize_merchant_images import optimize_image, metrics, POLICY

class ImageOptimizationTests(unittest.TestCase):
    def test_original_dimensions_alpha_and_cache(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);path=root/'image.png'
            y,x=np.mgrid[:256,:384]
            pixels=np.stack([x%256,y%256,(x+y)%256,np.where(x<100,128,255)],axis=-1).astype('uint8')
            Image.fromarray(pixels).save(path)
            before=path.read_bytes()
            data,report=optimize_image(path,root/'cache')
            self.assertEqual(before,path.read_bytes())
            self.assertLessEqual(len(data),len(before))
            with Image.open(io.BytesIO(data)) as result:
                self.assertEqual(result.size,(384,256))
                self.assertTrue(np.array_equal(np.asarray(result.convert('RGBA').getchannel('A')),pixels[:,:,3]))
                psnr,ssim=metrics(Image.open(path),result)
                self.assertGreaterEqual(psnr,POLICY['minPSNR'])
                self.assertGreaterEqual(ssim,POLICY['minBlockSSIM'])
            self.assertEqual((data,report),optimize_image(path,root/'cache'))
            # Corrupt cache must not silently enter a package.
            next((root/'cache').glob('*.webp')).write_bytes(b'broken')
            self.assertEqual((data,report),optimize_image(path,root/'cache'))

    def test_profile_untouched(self):
        with tempfile.TemporaryDirectory() as temp:
            p=Path(temp)/'profile.png'
            Image.new('RGB',(32,32),'red').save(p,icc_profile=b'profile-preserved')
            data,report=optimize_image(p,Path(temp)/'cache')
            self.assertEqual(data,p.read_bytes());self.assertEqual(report['format'],'original')

if __name__=='__main__':unittest.main()
