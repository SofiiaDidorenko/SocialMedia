// User App JavaScript

let registerSection = document.querySelector('.section-register')
let loginSection = document.querySelector('.section-login')
let registers = document.querySelectorAll('#register')
let logins = document.querySelectorAll('#login')
let buttonRegister = document.querySelector('.button-register')
let confirmSection = document.querySelector('.section-confirm')
let buttonBack = document.querySelector('.back')


registers.forEach(reg => {
    reg.addEventListener('click', function() {
        loginSection.style.display = "none"
        registerSection.style.display = "flex"
        
        logins.forEach(log => login.classList.remove('select'))
        registers.forEach(reg => reg.classList.add('select'))
    })
})

logins.forEach(log => {
    log.addEventListener('click', function() {
        loginSection.style.display = "flex"
        registerSection.style.display = "none"
        
        registers.forEach(reg => reg.classList.remove('select'))
        logins.forEach(log => login.classList.add('select'))
    })
})

