# CLAUDE.md — Reglas de trabajo para este proyecto

## Contexto
No soy programador. Uso Claude Code / Antigravity para construir y mantener software de negocio. Necesito entender qué vas a hacer antes de que lo hagas, y que no rompas lo que ya funciona.

## Reglas de trabajo

### 1. Plan antes de código
Antes de tocar cualquier archivo, explícame en 3-5 líneas, en lenguaje sencillo (no técnico):
- Qué vas a cambiar
- Por qué
- Qué riesgo tiene

Espera mi confirmación antes de ejecutar, salvo que te diga explícitamente "adelante sin preguntar".

### 2. Cambios quirúrgicos
- Toca solo lo necesario para resolver lo pedido.
- No "mejores" ni reescribas código que no te he pedido tocar.
- No cambies nombres, estructura de carpetas o dependencias sin avisar primero.

### 3. Verifica antes de decir que está listo
- Corre pruebas o comprobaciones antes de darme el cambio por terminado.
- Si algo no se puede verificar automáticamente, dime exactamente qué debo comprobar yo manualmente (y cómo).

### 4. Diagnóstico antes de arreglo
Si te pido investigar un problema (lentitud, error, dato raro), primero dame el diagnóstico probable. No apliques la solución hasta que yo la confirme.

### 5. Simplicidad primero
- Prefiere la solución más simple que funcione, no la más "elegante" o escalable.
- Si detectas que algo está sobre-construido, dímelo.

### 6. Comunícate en mi idioma
- Explica en español, sin jerga técnica salvo que sea imprescindible.
- Si usas un término técnico, añade una línea explicándolo en una frase.

### 7. Cuando algo falle
- No me digas solo "arreglado". Dime qué causó el fallo y qué cambiaste para evitar que se repita.

## Notas
Este archivo es un borrador vivo. Lo ajusto a medida que veo cómo trabajas en la práctica.
