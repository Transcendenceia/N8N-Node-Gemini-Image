import {
  IExecuteFunctions,
} from 'n8n-core';
import {
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';

export class GeminiImageGenerate implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Gemini Image Generate',
    name: 'geminiImageGenerate',
    icon: 'file:gemini.svg',
    group: ['transform'],
    version: 1,
    description: 'Genera imágenes con la API de Google Gemini (Imagen 4)',
    defaults: {
      name: 'Gemini Image Generate',
      color: '#00AAEE',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'geminiPalmApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Prompt',
        name: 'prompt',
        type: 'string',
        default: '',
        placeholder: 'Describe la imagen que querés',
        required: true,
      },
      {
        displayName: 'Aspect Ratio',
        name: 'aspectRatio',
        type: 'options',
        options: [
          {
            name: '1:1',
            value: '1:1',
          },
          {
            name: '4:3',
            value: '4:3',
          },
          {
            name: '16:9',
            value: '16:9',
          },
        ],
        default: '16:9',
      },
      {
        displayName: 'Sample Count',
        name: 'sampleCount',
        type: 'number',
        typeOptions: {
          minValue: 1,
          maxValue: 8,
        },
        default: 1,
        description: 'Número de imágenes a generar (máximo 8)',
      },
      {
        displayName: 'Model',
        name: 'modelId',
        type: 'options',
        options: [
          {
            name: 'Imagen 4 Ultra',
            value: 'models/imagen-4.0-ultra-generate-preview-06-06',
          },
          {
            name: 'Imagen 4',
            value: 'models/imagen-4.0-generate-preview-06-06',
          },
        ],
        default: 'models/imagen-4.0-ultra-generate-preview-06-06',
        description: 'ID del modelo Gemini a utilizar',
      },
      {
        displayName: 'Binary Property',
        name: 'binaryProperty',
        type: 'string',
        default: 'data',
        description: 'Nombre del campo binario donde se almacenará la imagen',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnItems: INodeExecutionData[] = [];

    const credentials = await this.getCredentials('geminiPalmApi');
    const apiKey = credentials.apiKey as string;

    for (let i = 0; i < items.length; i++) {
      const prompt = this.getNodeParameter('prompt', i) as string;
      const aspectRatio = this.getNodeParameter('aspectRatio', i) as string;
      const sampleCount = this.getNodeParameter('sampleCount', i) as number;
      const modelId = this.getNodeParameter('modelId', i) as string;
      const binaryProperty = this.getNodeParameter('binaryProperty', i) as string;

      const body = {
        instances: [
          {
            prompt,
          },
        ],
        parameters: {
          outputMimeType: 'image/jpeg',
          sampleCount,
          personGeneration: 'ALLOW_ADULT',
          aspectRatio,
        },
      };

      const qs = {
        key: apiKey,
      };

      const options = {
        method: 'POST' as const,
        url: `https://generativelanguage.googleapis.com/v1beta/${modelId}:predict`,
        qs,
        body,
        json: true,
      };

      // Realizamos la petición HTTP
      let response;
      try {
        response = await this.helpers.httpRequest(options);
      } catch (error) {
        throw new Error(`Error al llamar la API de Gemini: ${(error as Error).message}`);
      }

      if (!response?.predictions) {
        throw new Error('La respuesta de Gemini no incluye el campo "predictions"');
      }

      let imageIndex = 0;
      for (const prediction of response.predictions) {
        const base64 = prediction.bytesBase64Encoded as string | undefined;

        if (!base64 || base64 === 'null') {
          // Saltamos predicciones vacías
          continue;
        }

        imageIndex += 1;
        const buffer = Buffer.from(base64, 'base64');

        const newItem: INodeExecutionData = {
          json: {
            fileName: `image_${imageIndex}.jpeg`,
          },
          binary: {
            [binaryProperty]: {
              data: buffer.toString('base64'),
              mimeType: 'image/jpeg',
              fileName: `image_${imageIndex}.jpeg`,
            },
          },
        };

        returnItems.push(newItem);
      }
    }

    return [returnItems];
  }
}

