import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || '예상치 못한 오류가 발생했습니다.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('App ErrorBoundary caught error:', error, info.componentStack);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-screen bg-[#060d24] flex items-center justify-center p-6 text-white">
          <div
            className="w-full max-w-md rounded-2xl p-6 text-center shadow-2xl"
            style={{
              backgroundColor: '#08173d',
              border: '1.5px solid rgba(125, 211, 252, 0.5)',
            }}
          >
            <h1 className="text-xl font-extrabold text-amber-300">
              화면 오류가 발생했습니다
            </h1>
            <p className="mt-2 text-sm text-sky-100 break-keep leading-relaxed">
              게임을 다시 불러오면 정상적으로 이어서 플레이할 수 있습니다.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 px-6 py-2.5 rounded-xl text-sm font-extrabold text-slate-950 bg-amber-300 hover:bg-amber-200 cursor-pointer"
            >
              새로고침
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
