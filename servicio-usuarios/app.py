from flask import Flask, request, jsonify, redirect, url_for
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import or_
from modelos import db, User, Favorito
import os
from dotenv import load_dotenv
from datetime import timedelta

load_dotenv()

app = Flask(__name__)

app.config['JWT_SECRET_KEY'] = 'secreto'
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=1)

app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('SQLALCHEMY_DATABASE_URI')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')

db.init_app(app)

jwt = JWTManager(app)

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')  
    contrasena = data.get('password')

    usuario = User.query.filter(or_(User.email == email, User.nombre == email)).first()
    if usuario and usuario.check_password(contrasena):
        access_token = create_access_token(identity=usuario.email)
        return jsonify({
            "message": "Inicio de sesión exitoso.",
            "access_token": access_token,
            "nombre": usuario.nombre
        }), 200
    return jsonify({"message": "Credenciales inválidas."}), 401

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    nombre = data.get('nombre')
    email = data.get('email')  
    contrasena = data.get('password')

    if User.query.filter_by(nombre=nombre).first():
        return jsonify({"message": "Usuario ya existe."}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"message": "El correo electrónico ya está registrado."}), 400

    usuario = User(nombre=nombre, email=email)  
    usuario.set_password(contrasena)

    db.session.add(usuario)
    db.session.commit()

    return nombre

@app.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    try:
        return jsonify({"message": "Cierre de sesión exitoso."}), 200
    except Exception as e:
        return jsonify({"message": "Error al cerrar sesión."}), 500

@app.route('/addfavorito', methods=['POST'])
@jwt_required()
def add_favorito():
    try:
        email = get_jwt_identity()
        
        usuario = User.query.filter_by(email=email).first()

        if not usuario:
            return jsonify({"message": "Usuario no encontrado."}), 404

        data = request.get_json()
        equipo = data.get('nombreEquipo')

        favorito_existente = Favorito.query.filter_by(usuario_id=usuario.id, equipo=equipo).first()

        if favorito_existente:
            db.session.delete(favorito_existente)
            db.session.commit()
            
            return jsonify({"message": f"El equipo {equipo} ha sido eliminado de tus favoritos."}), 200
        else:
            favorito = Favorito(equipo=equipo, usuario=usuario)

            db.session.add(favorito)
            db.session.commit()
            
            return jsonify({"message": f"El equipo {equipo} ha sido añadido a tus favoritos."}), 201

    except Exception as e:
        return jsonify({"message": f"Error al agregar el equipo favorito: {str(e)}"}), 500

@app.route('/getfavorito', methods=['POST'])
@jwt_required()
def get_favorito():
    try:
        email = get_jwt_identity()
        
        usuario = User.query.filter_by(email=email).first()

        if not usuario:
            return jsonify({"message": "Usuario no encontrado."}), 404

        data = request.get_json()
        equipo = data.get('nombreEquipo')
        
        favorito_existente = Favorito.query.filter_by(usuario_id=usuario.id, equipo=equipo).first()

        if favorito_existente:
            return jsonify(), 200

        return jsonify(), 201

    except Exception as e:
        return jsonify({"message": f"Error al agregar el equipo favorito: {str(e)}"}), 500

@app.route('/favoritos', methods=['GET'])
@jwt_required() 
def get_favoritos():
    try:
        email = get_jwt_identity()
        usuario = User.query.filter_by(email=email).first()

        if not usuario:
            return jsonify({"message": "Usuario no encontrado."}), 404

        favoritos = Favorito.query.filter_by(usuario=usuario).all()

        lista_favoritos = [{"Equipo": f.equipo} for f in favoritos]

        return jsonify({"favoritos": lista_favoritos}), 200

    except Exception as e:
        return jsonify({"message": f"Error al obtener los equipos favoritos: {str(e)}"}), 500

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(host="0.0.0.0", port=5000, debug=True)