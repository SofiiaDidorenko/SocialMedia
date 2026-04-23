from django import forms
from django.contrib.auth import get_user_model
#from django.contrib.auth.forms import AuthenticationForm

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
            raise forms.ValidationError('A user with this email address already exists.')
        return email
    def clean(self):
        cleaned_data = super().clean()
        password = cleaned_data.get('password')
        confirm_password = cleaned_data.get('confirm_password')
        if password != confirm_password:
            self.add_error("password", "Password did'nt match")
            self.add_error("confirm_password", "Password did'nt match")
        return cleaned_data
    
#class UserLoginForm(AuthenticationForm):
    #username = forms.CharField(widget = forms.EmailInput(attrs = {
     #   'placeholder': 'Електронна пошта',
    #}))
    #password = forms.CharField(widget = forms.PasswordInput(attrs={
     #   'placeholder' : 'Пароль'    
  #  }))
    

    
        