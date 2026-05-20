from django import forms
from .models import Post, Tag, PostImage, PostLink
from PIL import Image
from io import BytesIO
from django.core.files.base import ContentFile

class PostForm(forms.ModelForm):
    tags = forms.ModelMultipleChoiceField(
        queryset=Tag.objects.all(),
        required=False,
        widget=forms.CheckboxSelectMultiple
    )

    class Meta:
        model = Post
        fields = ['title', 'topic', 'content']
        widgets = {
            'title': forms.TextInput(attrs={
                'placeholder': 'Природа, книга і спокій',
                'class': 'form-input'
            }),
            'topic': forms.TextInput(attrs={
                'placeholder': 'Напишіть тему публікації',
                'class': 'form-input'
            }),
            'content': forms.Textarea(attrs={
                'placeholder': 'Інколи найкращі ідеї народжуються в тиші...',
                'rows': 5,
                'class': 'form-textarea'
            }),
        }

    def save(self, author, images=None, links=None):
        post = super().save(commit=False)
        post.author = author
        post.save()
        
        if self.cleaned_data.get('tags'):
            post.tags.set(self.cleaned_data['tags'])

        if links:
            for url in links:
                if url.strip():
                    PostLink.objects.create(post=post, url=url.strip())

        if images:
            for img in images:
                compressed = self.compress_image(img)
                PostImage.objects.create(
                    post=post, 
                    original_image=img, 
                    compressed_image=compressed
                )
        
        return post

    def compress_image(self, image):
        image.seek(0)
        img = Image.open(image)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        
        buffer = BytesIO()
        img.save(buffer, format="JPEG", quality=75, optimize=True)
        return ContentFile(buffer.getvalue(), name=f"compressed_{image.name}")
