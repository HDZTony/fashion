"""
缩略图生成服务
用于下载原始图片、生成缩略图（压缩、缩小、加水印）
"""
import requests
from PIL import Image, ImageDraw, ImageFont
from io import BytesIO
from typing import Optional, Tuple
from pathlib import Path
import os


class ThumbnailService:
    """缩略图生成服务"""
    
    def __init__(
        self,
        thumbnail_size: Tuple[int, int] = (300, 300),
        quality: int = 40,
        watermark_text: Optional[str] = None,
        watermark_opacity: int = 128,  # 0-255
    ):
        """
        初始化缩略图服务
        
        Args:
            thumbnail_size: 缩略图尺寸 (width, height)
            quality: JPEG压缩质量 (1-100，数值越小文件越小)
            watermark_text: 水印文字（如果为None则不添加水印）
            watermark_opacity: 水印透明度 (0-255，255为完全不透明)
        """
        self.thumbnail_size = thumbnail_size
        self.quality = quality
        self.watermark_text = watermark_text
        self.watermark_opacity = watermark_opacity
    
    def download_image(self, image_url: str, timeout: int = 30) -> Optional[Image.Image]:
        """
        下载图片并返回PIL Image对象
        
        Args:
            image_url: 图片URL
            timeout: 下载超时时间（秒）
        
        Returns:
            PIL Image对象，如果下载失败则返回None
        """
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': image_url.split('/')[0] + '//' + image_url.split('/')[2] if '/' in image_url else image_url,
            }
            
            response = requests.get(image_url, headers=headers, timeout=timeout, stream=True)
            response.raise_for_status()
            
            # 使用BytesIO避免临时文件
            image_data = BytesIO()
            for chunk in response.iter_content(chunk_size=8192):
                image_data.write(chunk)
            image_data.seek(0)
            
            # 打开图片
            image = Image.open(image_data)
            
            # 转换为RGB格式（确保可以保存为JPEG）
            if image.mode in ('RGBA', 'LA', 'P'):
                # 创建白色背景
                rgb_image = Image.new('RGB', image.size, (255, 255, 255))
                if image.mode == 'P':
                    image = image.convert('RGBA')
                rgb_image.paste(image, mask=image.split()[-1] if image.mode in ('RGBA', 'LA') else None)
                image = rgb_image
            elif image.mode != 'RGB':
                image = image.convert('RGB')
            
            return image
            
        except Exception as e:
            print(f"[Thumbnail] 下载图片失败 {image_url}: {e}")
            return None
    
    def create_thumbnail(
        self,
        image: Image.Image,
        add_watermark: bool = True,
    ) -> Image.Image:
        """
        创建缩略图
        
        Args:
            image: PIL Image对象
            add_watermark: 是否添加水印
        
        Returns:
            处理后的缩略图PIL Image对象
        """
        # 调整尺寸，保持宽高比
        image.thumbnail(self.thumbnail_size, Image.LANCZOS)
        
        # 创建指定尺寸的缩略图（如果原图比例不同，会在边缘填充白色）
        thumbnail = Image.new('RGB', self.thumbnail_size, (255, 255, 255))
        
        # 计算居中位置
        paste_x = (self.thumbnail_size[0] - image.size[0]) // 2
        paste_y = (self.thumbnail_size[1] - image.size[1]) // 2
        thumbnail.paste(image, (paste_x, paste_y))
        
        # 添加水印
        if add_watermark and self.watermark_text:
            thumbnail = self._add_watermark(thumbnail)
        
        return thumbnail
    
    def _add_watermark(self, image: Image.Image) -> Image.Image:
        """
        在图片上添加半透明水印
        
        Args:
            image: PIL Image对象
        
        Returns:
            添加水印后的图片
        """
        # 创建水印层
        watermark = Image.new('RGBA', image.size, (255, 255, 255, 0))
        draw = ImageDraw.Draw(watermark)
        
        # 尝试加载字体
        font_size = max(12, min(image.size[0], image.size[1]) // 15)
        try:
            # 尝试使用系统字体
            if os.name == 'nt':  # Windows
                font_path = 'C:/Windows/Fonts/arial.ttf'
                if os.path.exists(font_path):
                    font = ImageFont.truetype(font_path, font_size)
                else:
                    font = ImageFont.load_default()
            elif os.name == 'posix':  # Linux/Mac
                try:
                    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', font_size)
                except:
                    font = ImageFont.load_default()
            else:
                font = ImageFont.load_default()
        except:
            font = ImageFont.load_default()
        
        # 计算文字位置（右下角）
        bbox = draw.textbbox((0, 0), self.watermark_text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        
        position = (
            image.size[0] - text_width - 10,  # 距离右边10像素
            image.size[1] - text_height - 10,  # 距离底部10像素
        )
        
        # 绘制半透明文字
        # 使用RGBA颜色，alpha值控制透明度
        text_color = (255, 255, 255, self.watermark_opacity)  # 白色半透明
        
        # 先绘制阴影（黑色半透明）以增强可读性
        shadow_position = (position[0] + 1, position[1] + 1)
        shadow_color = (0, 0, 0, self.watermark_opacity // 2)
        draw.text(shadow_position, self.watermark_text, font=font, fill=shadow_color)
        
        # 绘制主文字
        draw.text(position, self.watermark_text, font=font, fill=text_color)
        
        # 合并水印层和原图
        image = Image.alpha_composite(
            image.convert('RGBA'),
            watermark
        ).convert('RGB')
        
        return image
    
    def save_thumbnail(
        self,
        thumbnail: Image.Image,
        output_path: Path,
    ) -> Path:
        """
        保存缩略图到文件
        
        Args:
            thumbnail: PIL Image对象
            output_path: 输出文件路径
        
        Returns:
            保存后的文件路径
        """
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        # 保存为JPEG格式，使用指定的质量参数
        thumbnail.save(
            output_path,
            'JPEG',
            quality=self.quality,
            optimize=True,
        )
        
        return output_path
    
    def process_image_url(
        self,
        image_url: str,
        output_path: Path,
        add_watermark: bool = True,
    ) -> Optional[Path]:
        """
        完整的图片处理流程：下载 -> 生成缩略图 -> 保存
        
        Args:
            image_url: 原始图片URL
            output_path: 输出文件路径
            add_watermark: 是否添加水印
        
        Returns:
            保存后的文件路径，如果处理失败则返回None
        """
        # 下载图片
        image = self.download_image(image_url)
        if not image:
            return None
        
        # 生成缩略图
        thumbnail = self.create_thumbnail(image, add_watermark=add_watermark)
        
        # 保存缩略图
        return self.save_thumbnail(thumbnail, output_path)
    
    def process_image_file(
        self,
        input_path: Path,
        output_path: Path,
        add_watermark: bool = True,
    ) -> Optional[Path]:
        """
        处理本地图片文件：生成缩略图 -> 保存
        
        Args:
            input_path: 输入文件路径
            output_path: 输出文件路径
            add_watermark: 是否添加水印
        
        Returns:
            保存后的文件路径，如果处理失败则返回None
        """
        try:
            # 打开图片
            image = Image.open(input_path)
            
            # 转换为RGB
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # 生成缩略图
            thumbnail = self.create_thumbnail(image, add_watermark=add_watermark)
            
            # 保存缩略图
            return self.save_thumbnail(thumbnail, output_path)
            
        except Exception as e:
            print(f"[Thumbnail] 处理本地图片失败 {input_path}: {e}")
            return None


def create_thumbnail_from_url(
    image_url: str,
    output_path: Path,
    thumbnail_size: Tuple[int, int] = (300, 300),
    quality: int = 40,
    watermark_text: Optional[str] = None,
) -> Optional[Path]:
    """
    便捷函数：从URL创建缩略图
    
    Args:
        image_url: 原始图片URL
        output_path: 输出文件路径
        thumbnail_size: 缩略图尺寸
        quality: JPEG质量
        watermark_text: 水印文字
    
    Returns:
        保存后的文件路径，如果处理失败则返回None
    """
    service = ThumbnailService(
        thumbnail_size=thumbnail_size,
        quality=quality,
        watermark_text=watermark_text,
    )
    
    return service.process_image_url(image_url, output_path)

