from django import forms
from django.contrib.auth import get_user_model

User = get_user_model()

class RegisterForm(forms.ModelForm):
    confirm_password = forms.CharField(
        widget= forms.PasswordInput(attrs={
            'placeholder': 'Підтвердіть пароль',
            'class': 'input'
        })
    )
    class Meta:
        model = User
        fields = ['email', 'password']
        widgets = {
            'email': forms.EmailInput(attrs={
                'placeholder': 'Електронна пошта',
            }),
            'password': forms.PasswordInput(attrs={
                'placeholder': 'Пароль',
            })
        }
    def clean_email(self):
        email = self.cleaned_data.get('email')
        if get_user_model().objects.filter(email=email).exists():
            raise forms.ValidationError('Користувач з такою електронною поштою вже існує.')
        return email
    def clean(self):
        cleaned_data = super().clean()
        password = cleaned_data.get('password')
        confirm_password = cleaned_data.get('confirm_password')
        if password != confirm_password:
            self.add_error("password", "Password did'nt match")
            self.add_error("confirm_password", "Password did'nt match")
        return cleaned_data
    
        