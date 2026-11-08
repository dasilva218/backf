import "dotenv/config"
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';


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
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  app.setGlobalPrefix('api/v1');

  // Nombre de proxys de confiance devant l'API (Traefik/Coolify : 1). Sans ce
  // réglage, `req.ip` est l'adresse du proxy et le limiteur de débit met tous
  // les clients anonymes dans le même seau. À laisser à 0 si l'API est exposée
  // sans proxy : un client pourrait sinon choisir son IP via X-Forwarded-For.
  const sautsProxy = Number.parseInt(process.env.TRUST_PROXY ?? '0', 10);
  if (Number.isInteger(sautsProxy) && sautsProxy > 0) {
    app.set('trust proxy', sautsProxy);
  }

  // Pas de CORS : le navigateur n'appelle jamais l'API, seul le serveur Next le
  // fait (apps/web/lib/api.ts). L'ancien `origin: '*'` n'ouvrait qu'une surface.


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

  // La documentation interactive liste toutes les routes : servie en
  // développement, ou en production seulement si SWAGGER=1 est posé exprès.
  if (process.env.NODE_ENV !== 'production' || process.env.SWAGGER === '1') {
    const documentFactory = () => SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, documentFactory);
  }

  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3001);
})()

// await bootstrap();
