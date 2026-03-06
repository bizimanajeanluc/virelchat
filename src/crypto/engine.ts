import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';
import { get, set } from 'idb-keyval';

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

export interface DeviceKeys {
  identityKey: KeyPair;
  signedPreKey: KeyPair;
  oneTimePreKeys: KeyPair[];
}

export class CryptoEngine {
  private static getStorageKey(userId: string) {
    return `lds_chat_keys_${userId}`;
  }

  static async generateDeviceKeys(userId: string, count: number = 20): Promise<DeviceKeys> {
    const identityKey = nacl.box.keyPair();
    const signedPreKey = nacl.box.keyPair();
    const oneTimePreKeys = Array.from({ length: count }, () => nacl.box.keyPair());

    const keys: DeviceKeys = {
      identityKey: {
        publicKey: encodeBase64(identityKey.publicKey),
        privateKey: encodeBase64(identityKey.secretKey),
      },
      signedPreKey: {
        publicKey: encodeBase64(signedPreKey.publicKey),
        privateKey: encodeBase64(signedPreKey.secretKey),
      },
      oneTimePreKeys: oneTimePreKeys.map(k => ({
        publicKey: encodeBase64(k.publicKey),
        privateKey: encodeBase64(k.secretKey),
      })),
    };

    await set(this.getStorageKey(userId), keys);
    return keys;
  }

  static async getStoredKeys(userId: string): Promise<DeviceKeys | undefined> {
    if (!userId) return undefined;
    return await get(this.getStorageKey(userId));
  }

  static async encryptMessage(message: string, recipientPublicKey: string, userId: string, senderPrivateKey?: string): Promise<string> {
    const keys = await this.getStoredKeys(userId);
    if (!keys && !senderPrivateKey) throw new Error('No keys found');

    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const messageUint8 = decodeUTF8(message);
    const recipientPubKeyUint8 = decodeBase64(recipientPublicKey);
    const senderPrivKeyUint8 = decodeBase64(senderPrivateKey || keys!.identityKey.privateKey);

    const encrypted = nacl.box(
      messageUint8,
      nonce,
      recipientPubKeyUint8,
      senderPrivKeyUint8
    );

    const fullMessage = new Uint8Array(nonce.length + encrypted.length);
    fullMessage.set(nonce);
    fullMessage.set(encrypted, nonce.length);

    return encodeBase64(fullMessage);
  }

  static async decryptMessage(encryptedBase64: string, senderPublicKey: string, userId: string): Promise<string> {
    const keys = await this.getStoredKeys(userId);
    if (!keys) throw new Error('No keys found');

    const fullMessage = decodeBase64(encryptedBase64);
    const nonce = fullMessage.slice(0, nacl.box.nonceLength);
    const encrypted = fullMessage.slice(nacl.box.nonceLength);
    
    const senderPubKeyUint8 = decodeBase64(senderPublicKey);
    const recipientPrivKeyUint8 = decodeBase64(keys.identityKey.privateKey);

    const decrypted = nacl.box.open(
      encrypted,
      nonce,
      senderPubKeyUint8,
      recipientPrivKeyUint8
    );

    if (!decrypted) throw new Error('Failed to decrypt message');
    return encodeUTF8(decrypted);
  }
}
