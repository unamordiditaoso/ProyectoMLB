# MLBStats

> Proyecto de una aplicación web basada en microservicios (tanto Python como Node.js) para gestionar los equipos, los partidos y la clasificación de la mejor liga de Beisbol del mundo, la MLB. Compuesta por un frontend y varios microservicios independientes.

## Tabla de Contenidos

1. [Requisitos Previos](#requisitos-previos)
2. [Iniciar Servidor](#iniciar-servidor)
3. [Acceder Cliente](#acceder-cliente)

---

## Requisitos Previos

Asegúrate de tener instalado el siguiente programa antes de comenzar:

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

Después de instalarte el programa anterior, manténlo abierto para iniciar la aplicación.

> **Nota**: No necesitas tener Node.js ni MongoDB instalados localmente, ya que todo el entorno se ejecuta dentro de contenedores Docker.

---

## Iniciar Servidor

Para ejecutar el servidor necesitas realizar el siguiente comando desde la carpeta de Proyecto:

```bash
docker-compose up --build
```

---

## Acceder Cliente

Esta es la IP para acceder al lado cliente del proyecto:

- [http://localhost:3000/](http://localhost:3000/)
