from django import forms
from django.contrib.auth import get_user_model, authenticate
from django.contrib.auth.forms import AuthenticationForm

User = get_user_model()

class RegisterForm(forms.ModelForm):
    confirm_password = forms.CharField(
        label="Підтвердіть пароль",
        widget=forms.PasswordInput(attrs={
            'placeholder': 'Підтвердіть пароль',
            'class': 'input-field'
        })
    )

    class Meta:
        model = User
        fields = ['email', 'password']
        widgets = {
            'email': forms.EmailInput(attrs={
                'placeholder': 'you@example.com',
                'class': 'input-field'
            }),
            'password': forms.PasswordInput(attrs={
                'placeholder': 'Пароль',
                'class': 'input-field'
            })
        }

    def clean_email(self):
        email = self.cleaned_data.get('email')
        if User.objects.filter(email=email).exists():
            raise forms.ValidationError('Користувач з такою поштою вже існує.')
        return email

    def clean(self):
        cleaned_data = super().clean()
        password = cleaned_data.get('password')
        confirm_password = cleaned_data.get('confirm_password')
        
        if password and confirm_password and password != confirm_password:
            self.add_error("password", "Паролі не збігаються")
            self.add_error("confirm_password", "Паролі не збігаються")
        return cleaned_data

class ConfirmEmailForm(forms.Form):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
      
        for i in range(1, 7):
            self.fields[f'code{i}'] = forms.CharField(
                max_length=1,
                required=True,
                widget=forms.TextInput(attrs={
                    "class": "code-input",
                    "placeholder": "_",
                    "maxlength": 1,
                    "inputmode": "numeric",
                    "autocomplete": "one-time-code"
                })
            )

class LoginForm(AuthenticationForm):
    
    username = forms.EmailField(
        label='Електронна пошта',
        widget=forms.EmailInput(attrs={
            "autofocus": True,
            "placeholder": 'you@example.com',
            "class": "input-field"
        })
    )
    password = forms.CharField(
        label="Пароль",
        widget=forms.PasswordInput(attrs={
            "autocomplete": "current-password",
            "placeholder": "Введіть пароль",
            "class": "input-field"
        })
    )

    def clean(self):
        
        email = self.cleaned_data.get('username')
        password = self.cleaned_data.get('password')

        if email and password:
            self.user_cache = authenticate(
                self.request,
                username=email,
                password=password
            )

            if self.user_cache is None:
                raise self.get_invalid_login_error()
            else:
                self.confirm_login_allowed(self.user_cache)
        
        return self.cleaned_data