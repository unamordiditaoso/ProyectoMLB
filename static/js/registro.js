function revisarTexto() {
    const parrafo = document.getElementById('Mensaje');
    const texto = parrafo.innerText;


    if (texto.includes('Usuario registrado con éxito.')) {

        setTimeout(function() {
            window.location.href = "/";  // Redirige a la página de login
        }, 3000);
    } 
  }

  // Llamamos a la función para revisar el texto
  revisarTexto();