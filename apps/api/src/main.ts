import "dotenv/config"
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';


(async function bootstrap() {
  // `rawBody: true` conserve les octets reçus dans `req.rawBody`, en plus du
  // corps parsé. C'est indispensable à la vérification de la signature des
  // webhooks Ewuang : le HMAC porte sur le corps BRUT, et re-sérialiser le JSON
  // change les octets — ordre des clés, échappement des accents — donc invalide
  // la signature. Le piège est silencieux : sur un corps simple, JSON.stringify
  // rend parfois les mêmes octets et la vérification passe en développement
  // avant de casser en production, au premier « Colis récupéré ».
  //
  // Voir src/ewuang/ewuang-signature.ts, qui refuse de travailler autrement
  // qu'à partir d'un Buffer.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.setGlobalPrefix('api/v1');

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    maxAge: 600,
    allowedHeaders: ['Content-Type', 'Authorization'],
  })



  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,            // supprime les champs non déclarés dans les DTO
      forbidNonWhitelisted: true, // rejette la requête s'il y en a
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('trouver un  livreur')
    .setDescription('Find delivery API description')
    .setVersion('1.0')
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api', app, documentFactory);

  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3001);
})()

// await bootstrap();
