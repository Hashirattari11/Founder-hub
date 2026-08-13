"""Runtime environment detection for serverless vs long-running hosts."""
import os


def is_serverless() -> bool:
    """True on Vercel/AWS Lambda and similar ephemeral runtimes."""
    return bool(
        os.getenv("VERCEL")
        or os.getenv("VERCEL_ENV")
        or os.getenv("AWS_LAMBDA_FUNCTION_NAME")
        or os.getenv("AWS_EXECUTION_ENV")
    )
