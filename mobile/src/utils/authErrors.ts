const ERROR_MESSAGES: Record<string, string> = {
  'email, password and name are required': '请填写完整的账号、密码和姓名',
  'email and password are required': '请填写账号和密码',
  'password must be 4-15 characters': '密码长度需为4-15位',
  'name must be at most 20 characters': '姓名不能超过20个字符',
  'email or phone must be at most 25 characters': '邮箱或手机号不能超过25个字符',
  'Email already registered': '该邮箱或手机号已被注册',
  'Invalid email or password': '邮箱或密码不正确',
};

interface ServerErrorLike {
  response?: {
    data?: {
      error?: string;
    };
  };
}

function hasServerResponse(err: unknown): err is ServerErrorLike {
  return typeof err === 'object' && err !== null && 'response' in err;
}

export function describeAuthError(err: unknown, fallback: string): string {
  if (hasServerResponse(err)) {
    const serverMessage = err.response?.data?.error;
    if (typeof serverMessage === 'string' && serverMessage in ERROR_MESSAGES) {
      return ERROR_MESSAGES[serverMessage];
    }
  }
  return fallback;
}
