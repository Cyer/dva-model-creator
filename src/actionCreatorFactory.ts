export interface AnyAction {
  type: any;
}

export type Meta = null | { [key: string]: any };

export interface Action<Payload> extends AnyAction {
  type: string;
  payload: Payload;
  error?: boolean;
  meta?: Meta;
}

/**
 * Returns `true` if action has the same type as action creator.
 * Defines Type Guard that lets TypeScript know `payload` type inside blocks
 * where `isType` returned `true`.
 *
 * @example
 *
 *    const somethingHappened =
 *      actionCreator<{foo: string}>('SOMETHING_HAPPENED');
 *
 *    if (isType(action, somethingHappened)) {
 *      // action.payload has type {foo: string}
 *    }
 */
export function isType<Payload>(
  action: AnyAction,
  actionCreator: ActionCreator<Payload>
): action is Action<Payload> {
  return action.type === actionCreator.meta.type;
}

type VoidToOptional<P> = P extends void ? P | undefined : P;

export type ActionCreator<Payload> = {
  meta: {
    type: string;
  };
  originType: string;
  match: (action: AnyAction) => action is Action<Payload>;
  (payload: VoidToOptional<Payload>, meta?: Meta): Action<Payload>;
};

type OptionalError<Error> = Error extends void
  ? {
      error?: Error;
    }
  : {
      error: Error;
    };

type OptionalParams<Params> = Params extends void
  ? {
      params?: Params;
    }
  : {
      params: Params;
    };

type OptionalResult<Result> = Result extends void
  ? {
      result?: Result;
    }
  : {
      result: Result;
    };

export type Success<Params, Result> = OptionalResult<Result> & OptionalParams<Params>;

export type Failure<Params, Error> = OptionalError<Error> & OptionalParams<Params>;

export interface AsyncActionCreators<Params, Result, Error = {}> {
  meta: {
    type: string;
  };
  started: ActionCreator<Params>;
  done: ActionCreator<Success<Params, Result>>;
  failed: ActionCreator<Failure<Params, Error>>;
}

export interface PollActionCreator<Params> {
  meta: {
    type: string;
  };
  originType: string;
  start: ActionCreator<Params>;
  stop: ActionCreator<void>;
}

export interface ActionCreatorFactory {
  <Payload = void>(type: string, commonMeta?: Meta, isError?: boolean): ActionCreator<Payload>;

  <Payload = void>(
    type: string,
    commonMeta?: Meta,
    isError?: (payload: Payload) => boolean
  ): ActionCreator<Payload>;

  async<Params, Result, Error = {}>(
    type: string,
    commonMeta?: Meta
  ): AsyncActionCreators<Params, Result, Error>;

  poll<Params>(type: string, commonMeta?: Meta): PollActionCreator<Params>;

  updateNamespace(namespace: string): void;
}

declare const process: {
  env: {
    NODE_ENV?: string;
  };
};

export function actionCreatorFactory(
  prefix?: string | null,
  defaultIsError: (payload: any) => boolean = p => p instanceof Error
): ActionCreatorFactory {
  const actionTypes: { [type: string]: boolean } = {};

  let base = prefix ? `${prefix}/` : '';

  function actionCreator<Payload>(
    type: string,
    commonMeta?: Meta,
    isError: ((payload: Payload) => boolean) | boolean = defaultIsError
  ) {
    if (process.env.NODE_ENV !== 'production') {
      if (actionTypes[type]) throw new Error(`Duplicate action type: ${type}`);

      actionTypes[type] = true;
    }

    return Object.assign(
      (payload: Payload, meta?: Meta) => {
        const action: Action<Payload> = {
          type: `${base}${type}`,
          payload,
        };

        if (commonMeta || meta) {
          action.meta = Object.assign({}, commonMeta, meta);
        }

        if (isError && (typeof isError === 'boolean' || isError(payload))) {
          action.error = true;
        }

        return action;
      },
      {
        meta: {
          get type() {
            return `${base}${type}`;
          },
        },
        toString: () => `${base}${type}`,
        originType: type,
        match: (action: AnyAction): action is Action<Payload> => action.type === `${base}${type}`,
      }
    ) as ActionCreator<Payload>;
  }

  function asyncActionCreators<Params, Result, Error>(
    type: string,
    commonMeta?: Meta
  ): AsyncActionCreators<Params, Result, Error> {
    return {
      meta: {
        get type() {
          return `${base}${type}`;
        },
      },
      started: actionCreator<Params>(`${type}_STARTED`, commonMeta, false),
      done: actionCreator<Success<Params, Result>>(`${type}_DONE`, commonMeta, false),
      failed: actionCreator<Failure<Params, Error>>(`${type}_FAILED`, commonMeta, true),
    };
  }

  function pollActionCreators<Params>(type: string, commonMeta?: Meta): PollActionCreator<Params> {
    return {
      meta: {
        get type() {
          return `${base}${type}`;
        },
      },
      originType: type,
      start: actionCreator<Params>(`${type}-start`, commonMeta, false),
      stop: actionCreator(`${type}-stop`, commonMeta, false),
    };
  }

  function updateNamespace(namespace: string): void {
    base = namespace ? `${namespace}/` : '';
  }

  return Object.assign(actionCreator, {
    async: asyncActionCreators,
    poll: pollActionCreators,
    updateNamespace,
  });
}

export function removeActionNamespace(action: AnyAction) {
  let finalType: string = action.type;
  if (finalType.includes('/')) {
    finalType = finalType.split('/')[1];
  }
  action.type = finalType;
  return action;
}

export default actionCreatorFactory;
