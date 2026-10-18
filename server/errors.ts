
// export enum DatabaseError {
//   PoolExhausted = 'PoolExhausted',
//   NotFound = 'NotFound',
//   ConnectionLost = 'ConnectionLost',
// }

export class InternalError extends Error {
  information: string;
  constructor(additionnal_information: string) {
    super();
    this.information = additionnal_information
  }
}

export class AuthenticationError extends Error {
  message: string;
  constructor(message: string) {
    super("Authentication error: " + message);
    this.message = message
  }
}
